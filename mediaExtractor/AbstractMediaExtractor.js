'use strict'

import path from 'path'
import { Readable } from 'stream'
import { stat, mkdir } from "fs/promises"

import puppeteer from 'puppeteer'
const { Page } = puppeteer



/**
 * @typedef {Object} LoginInfo
 * @property {Object} id
 * @property {String} id.selector
 * @property {String} id.value
 * @property {Object} password
 * @property {String} password.selector
 * @property {String} password.value
 * @property {String} url
 * @property {Number} [timeout]
 * @property {Boolean} [isSplitLogin=false]
 */
/**
 * @typedef {Object} ExtractInfo
 * @property {String} url
 */

/**
 * @typedef {Object} MDI
 * @property {String} url Media download URL
 * @property {String} filename File name to save
 * @property {String} mediaId Media ID
 */
/**
 * @callback PushF
 * @param {MDI} data Media Download Information to stream
 * @returns
 */


/**
 * @abstract
 */
class AbstractMediaExtractor extends Readable {

    constructor(opt) {
        super(Object.assign({}, { objectMode: true }, opt))

        this._i = 0
        this._browser = null

        this._progressBar = opt.progressBar
        this._progress = this._progressBar && this._progressBar.getProgress()


        this.opt = opt
    }

    get opt() {
        return this._opt
    }

    set opt(opt) {
        this._opt = Object.assign({
            screenshot: {
                path: './screenshots'
            }
        }, opt)
    }

    /**
     * @private
     * @param {Number} size 
     * @returns {Any}
     */
    _read(size) {
        return super.read(size)
    }

    /**
     * @protected
     * @returns  {Promise}
     */
    async getBrowser() {
        return this._browser ? this._browser : (this._browser = await puppeteer.launch({ args: ['--no-sandbox'] }), this._browser)
    }

    /**
     * @protected
     * @returns  {Promise}
     */
    async getPage() {
        const browser = await this.getBrowser()
        return await browser.newPage()
    }

    /**
     * @protected
     * @param {Page} page
     * @returns {Promise}
     */
    async screenshot(page) {
        await stat(this.opt.screenshot.path)
            .catch(error => mkdir(this.opt.screenshot.path, { recursive: true }))
            .then(() => page.screenshot({ path: path.join(this.opt.screenshot.path, `${(++this._i).toString().padStart(4, '0')}.png`) }))
    }

    /**
     * @protected
     * @param {Page} page
     * @param {Number} [interval=5000]
     * @returns {Promise}
     */
    scrollDownToEnd(page, interval = 5000) {
        let totalHeight, old, count = 0
        return new Promise(resolve => {
            async function scrollDown() {
                setTimeout(async () => {
                    if (count < 3) {
                        totalHeight = await page.evaluate(() => {
                            return Promise.resolve(document.body.scrollHeight);
                        })
    
                        if (totalHeight === old) count++
                        else count = 0
                        
                        await page.mouse.wheel({ deltaY: totalHeight })
                        // await this.screenshot(page)
                        // console.log({old, totalHeight, count})
                        old = totalHeight
                        scrollDown.call(this)
                    } else resolve()
                }, interval)
            }
            scrollDown.call(this)
        })
    }

    /**
     * @protected
     * @param {Number} total 
     */
    printProgress(total) {
        if (this._progressBar) {
            this._progress.total = total
            this._progressBar.print()
            this._progressBar.watch()
        }
    }

    /**
     * @abstract
     * @protected
     * @param {LoginInfo} loginInfo
     */
    async login(loginInfo) {
        const browser = await this.getBrowser()
        const page = await browser.newPage()

        await page.goto(loginInfo.url, { 'waitUntil': 'load' })
        await this.screenshot(page)
        await page.waitForSelector(loginInfo.id.selector)
        await page.focus(loginInfo.id.selector)
        await page.keyboard.type(loginInfo.id.value)
        loginInfo.isSplitLogin && await page.keyboard.press('Enter')
        await this.screenshot(page)
        await page.waitForSelector(loginInfo.password.selector)
        await page.focus(loginInfo.password.selector)
        await page.keyboard.type(loginInfo.password.value)
        await page.keyboard.press('Enter')
        await this.screenshot(page)
        await page.waitForNetworkIdle().catch((error) => {})
        await this.screenshot(page)
        return page
    }

    /**
     * @abstract
     * @protected
     * @param {ExtractInfo} extractInfo
     * @param {Page} page
     * @param {PushF} push
     */
    async extract(extractInfo, page, push) { throw new Error('This method is not implemented.') }

    /**
     * @protected
     * @returns {Promise}
     */
     async close() {
        await (await this.getBrowser()).close()
    }

    /**
     * @public
     * @param {LoginInfo} loginInfo 
     * @param {ExtractInfo} extractInfo 
     */
     async run(loginInfo, extractInfo) {
        const page = loginInfo && await this.login(loginInfo)
        await this.extract(extractInfo, await this.getPage(), this.push.bind(this))
    }

}

export default AbstractMediaExtractor