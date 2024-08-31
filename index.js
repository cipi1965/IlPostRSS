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
import login from "./login.js";
import {getEpisodeInfo} from "./episodes.js";

const authenticate = {realm: 'Westeros'}
const fastify = Fastify({ logger: true })
fastify.register(fastifyRequestContext)

async function validate (username, password, req, reply) {
    const cookieJar = new CookieJar()

    if (username === process.env.AUTH_GENERIC_USERNAME && password === process.env.AUTH_GENERIC_PASSWORD) {
        await login(cookieJar, process.env.ILPOST_USERNAME, process.env.ILPOST_PASSWORD)
    } else {
        await login(cookieJar, username, password)
    }

    req.requestContext.set('jar', cookieJar)
}

fastify.register(import('@fastify/basic-auth'), { validate, authenticate })

fastify.after(() => {
    if (process.env.USE_BASIC_AUTH === 'true') {
        fastify.addHook('onRequest', fastify.basicAuth)
    }

    for (const [key, value] of Object.entries(podcasts)) {
        fastify.get(`/${key}`, async (request, reply) => {

            let cookieJar;
            if (process.env.USE_BASIC_AUTH === 'true') {
                cookieJar = request.requestContext.get('jar')
            } else {
                cookieJar = new CookieJar()
                login(cookieJar, process.env.ILPOST_USERNAME, process.env.ILPOST_PASSWORD)
            }

            const podcastInfo = await fetch(cookieJar, `https://www.ilpost.it/podcasts/${value.stringId}/`)
            const podcastInfoParsed = parse(await podcastInfo.text())
            const description = podcastInfoParsed.querySelector('._podcast-header__summary_1asv1_91').text;

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
                const episodeInfo = getEpisodeInfo(cookieJar, podcastEpisode.id)

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

            reply.header('Content-Type', 'application/xml')
            reply.send(feed.buildXml())
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