'use strict'

async function getMediaExtractor(type, config) {
    const MediaExtractor = (await import(`./module/${type}/index.js`)).default
    if (MediaExtractor) {
        return new MediaExtractor(config)
    } else throw new Error('This site is not supported.')
}

export { getMediaExtractor }