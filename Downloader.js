import path from 'path'
import { Writable } from 'stream'
import { createWriteStream } from "fs"
import { stat, mkdir } from "fs/promises"
import { request } from 'https'

class WorkerPool {
    constructor(maxPoolSize) {
        this._maxPoolSize = maxPoolSize || 10
        this._poolSize = 0
        this._readyQueue = []
    }

    addWork(work) {
        this._readyQueue.push(work)
        this._execute()
    }

    async _execute() {
        if (this._poolSize < this._maxPoolSize) {
            const work = this._readyQueue.shift()
            if (work) {
                this._poolSize++
                await work()
                this._poolSize--
                this._execute()
            }
        }
    }
}

export default class Downloader extends Writable {
    constructor(opt) {
        super(Object.assign({}, { objectMode: true }, opt))
        this._prefix = opt.downloadDir || './downloads'
        this._debug = opt.debug
        this._fileStreams = new Map()
        this._pool = new WorkerPool(opt.maxConcurrency)

        this._progressBar = opt.progressBar
        this._progress = this._progressBar && this._progressBar.getProgress()
        this._progress.twIds = new Set()
    }

    _write(chunk, encoding, callback) {
        const work = () => {
            this._debug && console.log(chunk)
            return new Promise((resolve, reject) => {
                const { url, username, filename, twId } = chunk
                // console.error({ url, username, filename, twId })
                const req = request(url, response => {
                    response.on('error', error => {
                        // callback(null)
                        if (this._progress) {
                            this._progress.twIds.add(twId)
                            this._progress.current = this._progress.twIds.size
                        }
                        resolve()
                    })
                    stat(path.join(this._prefix, username))
                        .catch(error => mkdir(path.join(this._prefix, username), { recursive: true }))
                        // .then(_stat => !_stat.isDirectory() && mkdir(path.join(this._prefix, username), { recursive: true }))
                        .then(() => {
                            const fileStream = createWriteStream(path.join(this._prefix, username, filename))
                            fileStream.on('error', error => {
                                console.log('fileStream error', chunk, response, error)
                                // callback(null)
                                if (this._progress) {
                                    this._progress.twIds.add(twId)
                                    this._progress.current = this._progress.twIds.size
                                }
                                resolve()
                            })
                            fileStream.on('close', () => {
                                // callback(null)
                                if (this._progress) {
                                    this._progress.twIds.add(twId)
                                    this._progress.current = this._progress.twIds.size
                                }
                                resolve()
                            })
                            response.pipe(fileStream)
                        })
                })
                req.on('error', error => {
                    console.log('request error', chunk, error)
                    // callback(null)
                    if (this._progress) {
                        this._progress.twIds.add(twId)
                        this._progress.current = this._progress.twIds.size
                    }
                    resolve()
                })
                req.end()
            })
        }
        this._pool.addWork(work)
        callback(null)
    }
}