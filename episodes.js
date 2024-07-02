import path from "path";
import fs from "fs";
import {fetch} from "node-fetch-cookies";

export async function getEpisodeInfo(cookieJar, podcastEpisodeId) {
    const cachePath = path.join(import.meta.dirname, 'cache', `${podcastEpisodeId}.json`)

    if (fs.existsSync(cachePath)) {
        return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } else {
        const episodeInfoResponse = await fetch(cookieJar, `https://www.ilpost.it/wp-json/wp/v2/episodes/${podcastEpisodeId}`)

        const episodeInfoText = await episodeInfoResponse.text()
        if (episodeInfoResponse.status === 200) {
            fs.writeFileSync(cachePath, await episodeInfoText);
            return JSON.parse(episodeInfoText)
        }

        return null
    }
}