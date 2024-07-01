import {fetch, CookieJar} from "node-fetch-cookies";
import Fastify from "fastify";
import { Podcast } from "podcast";
import 'dotenv/config'

const fastify = Fastify({ logger: true })

const cookieJar = new CookieJar()

const body = new URLSearchParams({
    log: process.env.ILPOST_USERNAME,
    pwd: process.env.ILPOST_PASSWORD,
    'wp-submit': 'Accedi',
    'testcookie': 1,
})

const login = await fetch(cookieJar,"https://www.ilpost.it/wp-login.php", {
    body: body.toString(),
    method: "POST",
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    }
})

fastify.get('/', async (request, reply) => {
    const podcast = await fetch(cookieJar, "https://www.ilpost.it/wp-admin/admin-ajax.php", {
        body: "action=checkpodcast&post_id=0&podcast_id=227474",
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
        }
    })
    const podcastJson = await podcast.json()

    const feed = new Podcast({
        title: 'Indagini',
        feedUrl: 'http://192.168.192.168:3000/',
        author: 'Il Post'
    })

    for (const podcastEpisode of podcastJson['data']['postcastList']) {
        feed.addItem({
            title: podcastEpisode.title,
            url: podcastEpisode.url,
            date: podcastEpisode.date,
            enclosure: {
                url: podcastEpisode.podcast_raw_url,
                type: 'audio/mpeg'
            }
        })
    }

    return feed.buildXml()
})

// Run the server!
try {
    await fastify.listen({ host: '0.0.0.0', port: 3000 })
} catch (err) {
    fastify.log.error(err)
    process.exit(1)
}