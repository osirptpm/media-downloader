import path from 'path'
import { stat, mkdir } from "fs/promises"
import { Readable } from 'stream'

import puppeteer from 'puppeteer'

export default class MediaExtractor extends Readable {
    constructor(opt) {
        super(Object.assign({}, { objectMode: true }, opt))
        this._i = 0
        this._browser = null
        this._debug = opt.debug
        this._progressBar = opt.progressBar
        this._progress = this._progressBar && this._progressBar.getProgress()
    }

    _read(size) {
        return super.read(size)
    }

    getBrowser() {
        return this._browser ? this._browser : (this._browser = puppeteer.launch({ args: ['--no-sandbox'] }), this._browser)
    }

    _generateFilename(id, createAt, url) {
        url = new URL(url)
        return createAt && id ? `${createAt.getFullYear()}${(createAt.getMonth() + 1).toString().padStart(2, '0')}${createAt.getDate().toString().padStart(2, '0')}-${createAt.getHours().toString().padStart(2, '0')}${createAt.getMinutes().toString().padStart(2, '0')}${createAt.getSeconds().toString().padStart(2, '0')}_${id}_${path.basename(url.pathname)}` : path.basename(url.pathname)
    }

    getAllMediaURL(url) {
        const username = (new URL(url).pathname).replace('/media', '')

        return new Promise((resolve, reject) => {
            const videos = new Set()
            const photos = new Set()
            let page
            this.getBrowser()
                .then(browser => browser.newPage())
                .then(_page => {
                    page = _page
                    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
                    page.on('response', response => {
                        if (this._progress && /UserByScreenName/i.test(response.request().url())) {
                            response.json().then(json => {
                                this._progress.total = json.data.user.result.legacy.media_count
                                this._progressBar.print()
                                this._progressBar.watch()
                            })
                        }
                        if (/UserMedia|UserTweets/i.test(response.request().url())) {
                            this._debug && console.log(response.request().url())
                            response.json().then(json => {
                                const medias = searchMedia.call(this, json)
                                for (let media of medias) {
                                    if (media) {
                                        switch (media.type) {
                                            case 'video':
                                                const _videos = media.video_info?.variants

                                                let video = { bitrate: 0 }
                                                if (_videos) {
                                                    for (let vid of _videos) {
                                                        video.bitrate < vid.bitrate && (video = vid)
                                                    }
                                                    if (video.url) {
                                                        if (!videos.has(video.url)) {
                                                            videos.add(video.url)
                                                            this._debug && console.log(video.url)
                                                            const [, twId] = /status\/([0-9]+)/.exec(media.expanded_url)
                                                            this.push({ url: video.url, username, twId, filename: this._generateFilename(twId, media._createAt, video.url) })
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
                                                        this.push({ url: media.media_url_https, username, twId, filename: this._generateFilename(twId, media._createAt, media.media_url_https) })
                                                    }
                                                }
                                                break

                                        }
                                    }
                                }
                            })
                        }
                    })
                    return page.goto(url)

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
                })
                .then(() => page.setViewport({
                    width: 1920,
                    height: 1080
                }))
                .then(async () => {
                    const timer = setInterval(async () => {
                        await page.screenshot({ path: `./screenshots/${(++this._i).toString().padStart(4, '0')}.png` }).catch(error => this._debug && console.warn('interval', error))
                    }, 5000)
                    await this.autoScroll(page)
                    clearInterval(timer)
                    setTimeout(async () => {
                        this._i = 0
                        page.browser().close()
                        resolve(videos)
                    }, 1000)
                })
        })
    }

    async autoScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                var oldY = -1, tmp
                var timer = setInterval(() => {
                    if (oldY === window.scrollY + window.innerHeight || oldY === document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                    this._debug && console.log(oldY, window.scrollY + window.innerHeight, window.scrollY + window.outerHeight, document.body.scrollHeight)
                    oldY = window.scrollY + window.innerHeight
                    window.scrollTo(0, document.body.scrollHeight)
                }, 5000);
            });
        });
    }

    async login(id, password) {
        const browser = await this.getBrowser()
        const page = await browser.newPage()

        await page.goto('https://twitter.com/login', { 'waitUntil': 'load' })
        await page.waitForSelector('input[autocomplete=username]')
        await page.focus('input[autocomplete=username]')
        await page.keyboard.type(id)
        await page.keyboard.press('Enter')
        await page.waitForSelector('input[type=password]')
        await page.focus('input[type=password]')
        await page.keyboard.type(password)
        await page.keyboard.press('Enter')

        stat(path.join(this._prefix, username))
            .catch(error => mkdir(path.join(this._prefix, username), { recursive: true }))
            .then(() => page.waitForResponse(response => /home\.json/.test(response.url())))
            .then(() => page.screenshot({ path: `./screenshots/${(++this._i).toString().padStart(4, '0')}.png` }))
            .then(() => this._debug && console.log('logged in'))
            .catch(error => this._debug && console.warn('login error', error))
    }
}