import { getMediaExtractor } from "../mediaExtractor/index.js"
import Downloader from "../Downloader.js"
import { getProgressBar } from "../progress.js"

import getPlantNames from './getPlantNames.js'

async function run() {
    const progressBar = getProgressBar(undefined, 'Downloading ')
    const downloader = new Downloader({
        maxConcurrency: 10,
        downloadDir: './downloads',
        debug: false,
        progressBar,
    })
    const mediaExtractor = await getMediaExtractor(
        'nature',
        {
            debug: false,
            progressBar
        })

    const url = `http://www.nature.go.kr/kbi/plant/pilbk/selectPlantPilbkGnrlList.do`

    mediaExtractor.pipe(downloader)
    mediaExtractor.setPlants = await getPlantNames('./test/나무이름.csv')
    mediaExtractor.run(null,
        {
            url: url
        })
}

run().catch(console.error)
