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
        if (this._progressBar) {
            this._progress = this._progressBar.getProgress()
            this._progress.mediaIds = new Set()
        }
    }

    _write(chunk, encoding, callback) {
        const work = () => {
            this._debug && console.log(chunk)
            const { url, filename, mediaId } = chunk
            const dirPath = path.dirname(path.join(this._prefix, filename))
            const filePath = path.join(this._prefix, filename)

            function _request(url) {
                return new Promise((resolve, reject) => {
                    const req = request(url, response => {
                        response.on('error', error => {
                            this._debug && console.error('response error', error)
                            // callback(null)
                            if (this._progress) {
                                this._progress.mediaIds.add(mediaId)
                                this._progress.current = this._progress.mediaIds.size
                            }
                            resolve()
                        })
                        if (response.statusCode >= 200 && response.statusCode <= 300) {
                            const fileStream = createWriteStream(path.extname(filename) ? filePath : `${filePath}${path.extname(new URL(`http://${response.req.host}${response.req.path}`).pathname)}`)
                            fileStream.on('error', error => {
                                this._debug && console.error('fileStream error', chunk, response, error)
                                // callback(null)
                                if (this._progress) {
                                    this._progress.mediaIds.add(mediaId)
                                    this._progress.current = this._progress.mediaIds.size
                                }
                                resolve()
                            })
                            fileStream.on('close', () => {
                                // callback(null)
                                if (this._progress) {
                                    this._progress.mediaIds.add(mediaId)
                                    this._progress.current = this._progress.mediaIds.size
                                }
                                resolve()
                            })
                            response.pipe(fileStream)
                        } else if (response.headers.location) {
                            resolve(_request.call(this, response.headers.location))
                        } else resolve()
                    })
                    req.on('error', error => {
                        this._debug && console.error('request error', chunk, error)
                        // callback(null)
                        if (this._progress) {
                            this._progress.mediaIds.add(mediaId)
                            this._progress.current = this._progress.mediaIds.size
                        }
                        resolve()
                    })
                    req.end()
                })
            }

            return stat(dirPath)
                .catch(error => mkdir(dirPath, { recursive: true }))
                .then(() => _request.call(this, url))
        }
        this._pool.addWork(work)
        callback(null)
    }
}