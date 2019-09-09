#! /usr/bin/env node
// tslint:disable: no-console
import * as fs from 'fs';
import { extname, join } from 'path';
import { parseEpubAtPath } from '.';
import { promisify, inspect } from 'util';
import { extractNodeText } from 'booka-common';

exec();

async function exec() {
    const args = process.argv;
    const path = args[2];
    const reportMeta = args[3] ? false : true;
    if (!path) {
        console.log('You need to pass epub path as an arg');
        return;
    }
    if (!fs.existsSync(path)) {
        console.log(`Couldn't find file or directory: ${path}`);
        return;
    }

    const files = await listFiles(path);
    const epubs = files.filter(isEpub);
    console.log(epubs);
    for (const epubPath of epubs) {
        const result = await parseEpubAtPath(epubPath);
        if (!result.success) {
            console.log(`Couldn't parse epub: '${epubPath}'`);
            continue;
        }
        console.log(`---- ${epubPath}:`);
        if (reportMeta) {
            console.log('Tags:');
            console.log(result.value.tags);
            const bookText = extractNodeText(result.value.volume);
            console.log(`Book length: ${bookText && bookText.length} symbols`);
        }
        if (Array.isArray(result.message) && result.message.length > 0) {
            console.log('\x1b[31mDiagnostics:\x1b[0m');
            console.log(inspect(result.message, false, null, true));
        }
    }
}

async function listFiles(path: string) {
    const isDirectory = (await promisify(fs.lstat)(path)).isDirectory();
    if (isDirectory) {
        const files = await promisify(fs.readdir)(path);
        return files.map(f => join(path, f));
    } else {
        return [path];
    }
}

function isEpub(path: string): boolean {
    return extname(path) === '.epub';
}
