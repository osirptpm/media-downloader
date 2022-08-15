'use stirct'

import fs from 'fs'

export default async function getPlantNames(filename) {
    const content = await fs.promises.readFile(filename)
    const a = content.toString().split('\n').map(value => value.trim()).filter(value => value.length !== 0)
    return a
}