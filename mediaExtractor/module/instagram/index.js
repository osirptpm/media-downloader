'use strict'

import path from 'path'

import puppeteer from 'puppeteer'
const { Page } = puppeteer

import AbstractMediaExtractor from '../../AbstractMediaExtractor.js'

class InstagramMediaExtractor extends AbstractMediaExtractor {

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
    async login({ id, password }) {
        const page = await super.login({
            id: {
                selector: 'input[type=text]',
                value: id
            },
            password: {
                selector: 'input[type=password]',
                value: password
            },
            url: 'https://www.instagram.com/accounts/login/',
            isSplitLogin: false
        })
        const btnSelector = '.sqdOP.yWX7d.y3zKF'
        await page.waitForSelector(btnSelector)
        await page.click(btnSelector)
        await page.waitForNetworkIdle().catch((error) => { })

        await this.screenshot(page)
        return page
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
        const username = (new URL(extractInfo.url).pathname).replace('/', '')
        let articleCount = null
        page.on('console', (msg) => this._debug && console.log('PAGE LOG:', msg.text()))
        page.on('response', response => {

            if (/www\.instagram\.com\/jiwonstein\/$/.test(response.request().url())) {
                this._debug && console.log(response.request().url())
                response.text().then(text => {
                    const matched = text.match(/window\._sharedData = (\{.*\})/)
                    if (matched) {
                        const _sharedData = JSON.parse(matched[1])
                        const edges = _sharedData?.entry_data?.ProfilePage[0]?.graphql?.user?.edge_owner_to_timeline_media?.edges
                        edges && getMedia(edges)
                    }
                })
            }

            if (/graphql\/query/i.test(response.request().url())) {
                this._debug && console.log(response.request().url())
                response.json().then(json => {
                    if (!articleCount) {
                        articleCount = json.data.user.edge_owner_to_timeline_media.count, this.printProgress(articleCount)
                    }

                    const edges = json.data?.user?.edge_owner_to_timeline_media?.edges
                    edges && getMedia(edges)


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

        function getMedia(edges, id, createAt) {
            edges.forEach(({ node }) => {
                let url, _node
                if (node.is_video && node.video_url) {
                    url = node.video_url
                    _node = node
                } else {
                    // images
                    if (node.edge_sidecar_to_children) {
                        getMedia(node.edge_sidecar_to_children.edges, node.id, new Date(node.taken_at_timestamp * 1000))
                    } else {
                        if (node.display_resources) {
                            let max = -1, maxIndex = 0
                            for (const index in node.display_resources) {
                                max = node.display_resources[index].config_width > max ? (node.display_resources[index].config_width, maxIndex = index) : max
                            }
                            url = node.display_resources[maxIndex].src
                            _node = node
                        } else if (node.display_url) {
                            url = node.display_url
                            _node = node
                        }
                    }
                }
                if (_node) {
                    const _createAt = createAt ? createAt : (_node.taken_at_timestamp ? new Date(_node.taken_at_timestamp * 1000) : null)
                    push({ url, filename: generateFilename(id ? id : _node.id, _createAt, url, username), mediaId: id ? id : _node.id })
                }
            })
        }
    }
}

export default InstagramMediaExtractor

function generateFilename(id, createAt, url, username) {
    url = new URL(url)
    return path.join(username, createAt && id ? `${createAt.getFullYear()}${(createAt.getMonth() + 1).toString().padStart(2, '0')}${createAt.getDate().toString().padStart(2, '0')}-${createAt.getHours().toString().padStart(2, '0')}${createAt.getMinutes().toString().padStart(2, '0')}${createAt.getSeconds().toString().padStart(2, '0')}_${id}_${path.basename(url.pathname)}` : path.basename(url.pathname))
}