import { getMediaExtractor } from "./mediaExtractor/index.js"
import Downloader from "./Downloader.js"
import { getProgressBar } from "./progress.js"

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("./config.json");


export async function run(userId) {
    const progressBar = getProgressBar(undefined, 'Downloading ')
    const downloader = new Downloader({
        maxConcurrency: 10,
        downloadDir: './downloads',
        debug: false,
        progressBar,
    })
    const mediaExtractor = await getMediaExtractor(
        'twitter',
        {
            debug: false,
            progressBar
        })

    const url = `https://x.com/${userId}/`

    mediaExtractor.pipe(downloader)
    mediaExtractor.run({
        id: config.id,
        password: config.password
    },
        {
            url: url
        })
}

// run().catch(console.error)
