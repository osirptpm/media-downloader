'use strict'

const CONST = {
    PROGRESS: {
        START: '[',
        END: ']',
        UNIT: '=',
    }
}
export function getProgressBar(progress = { current: 0, total: 100 }, info = 'Progressing ', placeholder = { current: ':current', total: ':total', pad: ':pad' }) {
    info = info + ':current:padToatal: :total'
    let bar = `${CONST.PROGRESS.START}:pad${CONST.PROGRESS.END}`, isFirst = true

    const progressBar = {
        print(_progress) {
            _progress?.current && (progress.current = _progress.current)
            _progress?.total && (progress.total = _progress.total)
            // Object.assign(progress, { current: _progress.current, total: _progress.total })
            _print()
        },
        getProgress() {
            return progress
        },
        flush() {
            process.stdout.write('\r\n\r\n')
        },
        watch() {
            progress.isWatch = true
        },
        unwatch() {
            progress.isWatch = false
        }
    }
    if (typeof progress._current !== 'number') {
        progress._current = 0
        Object.defineProperty(progress, 'current', {
            set: (val) => {
                progress._current = val < progress.total ? val : progress.total
                if (progress.isWatch) {
                    _print()
                    progress.current >= progress.total && progressBar.unwatch(progress)
                }
            },
            get: () => { return progress._current }
        })
    }
    return progressBar
    
    function _print() {
        let _info = info.replace(placeholder.current, progress.current)
            .replace(placeholder.total, progress.total)
        _info = setPad(_info, placeholder)
        let _bar = setPad(bar, placeholder)
        _bar = setProgress(_bar, progress)
        isFirst && (isFirst = false, process.stdout.write('\r\n\r\n'))
        process.stdout.write('\u001B[2F')
        process.stdout.write(`${_info}\r\n`)
        process.stdout.write(`${_bar}\r\n`)
        // process.stdout.write(progress.current === progress.total ? '\r\n' : '\u001B[2F')
    }
}

function setPad(str, placeholder, fillString = ' ') {
    const width = process.stdout.columns
    const padCount = width - str.length + placeholder.pad.length
    switch (true) {
        case padCount >= 0: return str.replace(placeholder.pad, fillString.repeat(padCount))
        case padCount < 0: return str.replace(placeholder.pad, fillString.repeat(0))
    }
}
function setProgress(bar, progress) {
    const width = process.stdout.columns
    const _width = width - CONST.PROGRESS.START.length - CONST.PROGRESS.END.length
    let position = (progress.current * _width / progress.total)
    position += CONST.PROGRESS.START.length // adjust for replace
    position = position + CONST.PROGRESS.END.length > width ? width - CONST.PROGRESS.END.length : position
    const percentage = Math.round(progress.current / progress.total * 100) + '%'
    return bar
        .replace(CONST.PROGRESS.START.padEnd(position, ' '), CONST.PROGRESS.START.padEnd(position, '='))
        .replace(new RegExp(`[^\\${CONST.PROGRESS.START}\\${CONST.PROGRESS.END}${CONST.PROGRESS.UNIT}]`), '>')
        .replace(new RegExp(`(.{${Math.floor(width / 2 - percentage.length / 2 - 1)}})(.{${percentage.length + 2}})`), (match, p1, p2) => `${p1} ${percentage} `)
}

// const progressBar = getProgressBar({ current: 0, total: 690 })
// const progressBar2 = getProgressBar({ current: 0, total: 1240 })
// progressBar.watch()
// progressBar2.watch()
// const timer = setInterval(() => {
//     if (progressBar.getProgress().current === progressBar.getProgress().total && progressBar2.getProgress().current === progressBar2.getProgress().total) return clearInterval(timer)
//     progressBar.getProgress().current += 60
//     progressBar2.getProgress().current += 30
// }, 100)