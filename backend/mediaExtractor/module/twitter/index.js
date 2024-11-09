'use strict'

import path from 'path'

import puppeteer from 'puppeteer'
const { Page } = puppeteer

import AbstractMediaExtractor from '../../AbstractMediaExtractor.js'

class TwitterMediaExtractor extends AbstractMediaExtractor {

    constructor(opt) {
        super(opt)
        
        if (opt) {
            this._debug = opt.debug
        }
    }

    /**
     * 
     * @param {Object} auth
     * @param {String} auth.id
     * @param {String} auth.password
     * @returns {Promise}
     */
    async login({id, password}) {
        return super.login({
            id: {
                selector: 'input[autocomplete=username]',
                value: id
            },
            password: {
                selector: 'input[type=password]',
                value: password
            },
            url: 'https://twitter.com/login',
            isSplitLogin: true
        })
    }

    /**
     * 
     * @param {import('../../AbstractMediaExtractor.js').ExtractInfonfo} extractInfo
     * @param {Page} page
     * @param {import('../../AbstractMediaExtractor.js').PushF} _push
     */
    async extract(extractInfo, page, _push) {
        const push = data => {
            this._debug && console.log(data)
            _push(data)
        }
        const username = (new URL(extractInfo.url).pathname).replace('/media', '')
        const videos = new Set()
        const photos = new Set()
        page.on('console', (msg) => this._debug && console.log('PAGE LOG:', msg.text()))
        page.on('response', response => {
            if (/UserByScreenName/i.test(response.request().url())) {
                response.json().then(json => {
                    this.printProgress(json.data.user.result.legacy.media_count)
                })
            }
            if (/UserMedia|UserTweets/i.test(response.request().url())) {
                this._debug && console.log(response.request().url())
                response.json().then(json => {
                    const medias = searchMedia.call(this, json)
                    for (let media of medias) {
                        if (media) {
                            switch (media.type) {
                                case 'animated_gif':
                                case 'video':
                                    const _videos = media.video_info?.variants

                                    let video = { bitrate: -1 }
                                    if (_videos) {
                                        for (let vid of _videos) {
                                            video.bitrate < vid.bitrate && (video = vid)
                                        }
                                        if (video.url) {
                                            if (!videos.has(video.url)) {
                                                videos.add(video.url)
                                                this._debug && console.log(video.url)
                                                const [, twId] = /status\/([0-9]+)/.exec(media.expanded_url)
                                                push({ url: video.url, mediaId: twId, filename: generateFilename(twId, media._createAt, video.url, username) })
                                            }
                                        }
                                    }
                                    break
                                case 'photo':
                                    if (media.media_url_https) {
                                        if (!photos.has(media.media_url_https)) {
                                            photos.add(media.media_url_https)
                                            this._debug && console.log(media.media_url_https)
                                            const [, twId] = /status\/([0-9]+)/.exec(media.expanded_url)
                                            push({ url: media.media_url_https, mediaId: twId, filename: generateFilename(twId, media._createAt, media.media_url_https, username) })
                                        }
                                    }
                                    break
                                default: this._debug && console.log('unknown type', media.type, media)
                            }
                        }
                    }
                })
            }
        })
        await page.setViewport({
            width: 1920,
            height: 1080
        })
        await page.goto(extractInfo.url)
        await this.scrollDownToEnd(page)
        await this.close()
    }
}

export default TwitterMediaExtractor

function searchMedia(json, medias = [], createAt) {
    if (typeof json === 'object') {
        for (const [key, value] of Object.entries(json)) {
            if (key === 'media') {
                // this._progress && this._progress.current++
                medias.push(...value.map(media => (media._createAt = new Date(createAt), media)))
            } else {
                if (key !== 'entities') {
                    if (key === 'legacy') {
                        createAt = value.created_at
                    }
                    searchMedia.call(this, json[key], medias, createAt)
                }
            }
        }
    }
    return medias
}

function generateFilename(id, createAt, url, username) {
    url = new URL(url)
    return path.join(username, createAt && id ? `${createAt.getFullYear()}${(createAt.getMonth() + 1).toString().padStart(2, '0')}${createAt.getDate().toString().padStart(2, '0')}-${createAt.getHours().toString().padStart(2, '0')}${createAt.getMinutes().toString().padStart(2, '0')}${createAt.getSeconds().toString().padStart(2, '0')}_${id}_${path.basename(url.pathname)}` : path.basename(url.pathname))
}