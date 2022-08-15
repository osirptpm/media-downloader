'use strict'

import path from 'path'

import puppeteer from 'puppeteer'
const { Page } = puppeteer

import AbstractMediaExtractor from '../../AbstractMediaExtractor.js'

class NatureMediaExtractor extends AbstractMediaExtractor {

    constructor(opt) {
        super(opt)

        if (opt) {
            this._debug = opt.debug
        }
    }

    set setPlants(names) { this._names = names }

    /**
     * 
     * @param {Object} auth
     * @param {String} auth.id
     * @param {String} auth.password
     * @returns {Promise}
     */
    async login({ id, password }) { }

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
        let ImgCount = 0, passedNames = [], failedNames = []
        page.on('console', (msg) => this._debug && console.log('PAGE LOG:', msg.text()))
        page.on('response', response => {
            // const status = response.status()
            // if (status < 300 && status >= 200) {
            //     if (/graphql\/query/i.test(response.request().url())) {
            //     }
            // }
        })
        await page.setViewport({
            width: 1920,
            height: 1080
        })

        if (Array.isArray(this._names)) {
            for (let index in this._names) {
                index = parseInt(index)
                if (index === 0) {
                    console.log(`전체: ${this._names.length} | 현재: ${index + 1} | 성공: ${passedNames.length} | 실패: ${failedNames.length}`)
                    console.log(`${this._names[index]} 검색 중...`)
                } else {
                    process.stdout.write('\u001b[s')
                    process.stdout.write('\u001b[4A')
                    console.log(`전체: ${this._names.length} | 현재: ${index + 1} | 성공: ${passedNames.length} | 실패: ${failedNames.length}`)
                    process.stdout.write('\u001b[2K')
                    console.log(`${this._names[index]} 검색 중...`)
                    process.stdout.write('\u001b[u')
                }
                await page.goto(extractInfo.url)
                await searchPlant(this._names[index])
                await this.screenshot(page)
                const isFound = await goToDetail(this._names[index])
                await this.screenshot(page)
                if (isFound) {
                    await getMedia.call(this)
                    await this.screenshot(page)
                    passedNames.push(this._names[index])
                } else {
                    failedNames.push(this._names[index])
                }
            }
        }

        process.stdout.write('\u001b[s')
        process.stdout.write('\u001b[4A')
        process.stdout.write('\u001b[2K')
        console.log(`전체: ${this._names.length} | 성공: ${passedNames.length} | 실패: ${failedNames.length}`)
        process.stdout.write('\u001b[2K')
        console.log(`실패 항목: ${failedNames.join(', ')}`)
        process.stdout.write('\u001b[u')
        await this.close()


        async function searchPlant(name) {
            const bodyHandle = await page.$('body')
            await page.evaluate((body, name) => {
                const input = body.querySelector('#searchWrd')
                input.value = name
                body.querySelector('#inSearchCnd1').selectedIndex = 1
                const btn = body.querySelector('#txt > form:nth-child(3) > fieldset > div > input')
                btn.click()
            }, bodyHandle, name)
            await bodyHandle.dispose()
        }

        async function goToDetail(name) {
            let isFound, bodyHandle
            try {
                await page.waitForSelector('#txt > form:nth-child(3) > ul.nature_thumlist03 > li:nth-child(1)', { timeout: 10000 })
                bodyHandle = await page.$('body')
                isFound = await page.evaluate((body, name) => {
                    const aElement = body.querySelector('#txt > form:nth-child(3) > ul.nature_thumlist03 > li:nth-child(1) > p.title > span > a')
                    aElement.textContent.trim()
                    if (new RegExp(name).test(aElement.textContent.trim())) {
                        aElement.click()
                        return true
                    } else return false
                }, bodyHandle, name)
            } catch (error) {
                isFound = false
            } finally {
                bodyHandle && await bodyHandle.dispose()
            }
            return isFound
        }
        async function getMedia() {
            await page.waitForSelector('#txt > div.nature_thumview01_imggallery', { timeout: 10000 })
            const bodyHandle = await page.$('body')
            const fileName = await page.evaluate(body => body.querySelector('#txt > div.nature_thumview01 > dl > dd:nth-child(2) > span > strong').textContent, bodyHandle)
            const imgList = await page.evaluate(body => [...body.querySelectorAll('#txt > div.nature_thumview01_imggallery > ul > li > a')].map(el => el.getAttribute('onclick').split(',')[0].match(/\'(.*)\'/)[1]), bodyHandle)
            await bodyHandle.dispose()

            if (imgList.length > 0) {
                ImgCount += imgList.length
                ImgCount && this.printProgress(ImgCount)
            }

            for (let index in imgList) {
                const imagePath = imgList[index]
                push({ url: `${new URL(page.url()).origin}${imagePath}`, mediaId: `${path.basename(imagePath)}/${fileName}/${index}`, filename: generateFilename(fileName, parseInt(index) + 1, imagePath) })
            }

            function getImgList(body) {
                return [...body.querySelectorAll('#txt > div.nature_thumview01_imggallery > ul > li > a')].map(el => el.getAttribute('onclick').split(',')[0].match(/\'(.*)\'/)[1])
            }

            function getFileName(body) {
                return body.querySelector('#txt > div.nature_thumview01 > dl > dd:nth-child(2) > span > strong').textContent
            }
        }
    }
}

export default NatureMediaExtractor

function generateFilename(fileName, index, imagePath) {
    return path.join(`${fileName}_${index}${path.extname(imagePath).toLowerCase()}`)
}