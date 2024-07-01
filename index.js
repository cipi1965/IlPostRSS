import {fetch, CookieJar} from "node-fetch-cookies";
import Fastify from "fastify";
import { Podcast } from "podcast";
import 'dotenv/config'
import path from 'path'
import podcasts from './podcasts.js'
import { parse } from 'node-html-parser';
import fs from 'fs';
import { stripHtml } from "string-strip-html";
import { fastifyRequestContext } from '@fastify/request-context'

const authenticate = {realm: 'Westeros'}
const fastify = Fastify({ logger: true })
fastify.register(fastifyRequestContext)

async function validate (username, password, req, reply) {
    const cookieJar = new CookieJar()

    const body = new URLSearchParams({
        log: username,
        pwd: password,
        'wp-submit': 'Accedi',
        'testcookie': 1,
    })

    await fetch(cookieJar,"https://www.ilpost.it/wp-login.php", {
        body: body.toString(),
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
        }
    })

    req.requestContext.set('jar', cookieJar)
}

fastify.register(import('@fastify/basic-auth'), { validate, authenticate })

fastify.get('/test', async (request, reply) => {
    console.log(request.headers)
})
fastify.after(() => {
    fastify.addHook('onRequest', fastify.basicAuth)

    for (const [key, value] of Object.entries(podcasts)) {
        fastify.get(`/${key}`, async (request, reply) => {
            const cookieJar = request.requestContext.get('jar')

            const podcastInfo = await fetch(cookieJar, `https://www.ilpost.it/episodes/podcasts/${value.stringId}/`)
            const podcastInfoParsed = parse(await podcastInfo.text())
            const description = podcastInfoParsed.querySelector('.ilpostPodcastDesc').text;

            const podcastList = await fetch(cookieJar, "https://www.ilpost.it/wp-admin/admin-ajax.php", {
                body: `action=checkpodcast&post_id=0&podcast_id=${value.id}`,
                method: "POST",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
                }
            })
            const podcastListJson = await podcastList.json()

            const feed = new Podcast({
                title: value.title,
                imageUrl: value.cover,
                description: description,
                siteUrl: `https://www.ilpost.it/episodes/podcasts/${value.stringId}/`,
                feedUrl: `${process.env.BASE_URL}/${key}`,
                author: 'Il Post',
                itunesImage: value.cover,
            })

            for (const podcastEpisode of podcastListJson['data']['postcastList']) {
                const cachePath = path.join(import.meta.dirname, 'cache', `${podcastEpisode.id}.json`)
                let episodeInfo = null

                if (fs.existsSync(cachePath)) {
                    episodeInfo = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                } else {
                    const episodeInfoResponse = await fetch(cookieJar, `https://www.ilpost.it/wp-json/wp/v2/episodes/${podcastEpisode.id}`)

                    const episodeInfoText = await episodeInfoResponse.text()
                    if (episodeInfoResponse.status === 200) {
                        fs.writeFileSync(cachePath, await episodeInfoText);
                        episodeInfo = JSON.parse(episodeInfoText)
                    }
                }

                const episodeDescription = stripHtml(episodeInfo?.content?.rendered ?? '').result

                feed.addItem({
                    title: podcastEpisode.title,
                    url: podcastEpisode.url,
                    date: podcastEpisode.date,
                    description: episodeDescription,
                    enclosure: {
                        url: podcastEpisode.podcast_raw_url,
                        type: 'audio/mpeg'
                    }
                })
            }

            return feed.buildXml()
        })
    }
})

// Run the server!
try {
    await fastify.listen({ host: '0.0.0.0', port: 3000 })
} catch (err) {
    fastify.log.error(err)
    process.exit(1)
}