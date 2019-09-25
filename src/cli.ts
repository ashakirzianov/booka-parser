#! /usr/bin/env node
// tslint:disable: no-console
import * as fs from 'fs';
import { extname, join } from 'path';
import { parseEpub } from '.';
import { promisify, inspect } from 'util';
import { extractNodeText } from 'booka-common';
import { topDiagnostic } from './combinators';

exec();

async function exec() {
    const args = process.argv;
    const path = args[2];
    const reportMeta = args[3] ? true : false;
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
    logTimeAsync('parsing', async () => {
        for (const epubPath of epubs) {
            await processEpubFile(epubPath, reportMeta);
        }
    });
}

async function processEpubFile(filePath: string, reportMeta: boolean) {
    const result = await parseEpub({ filePath });
    if (!result.success) {
        logRed(`Couldn't parse epub: '${filePath}'`);
        console.log(result.diagnostic);
        return;
    }
    const book = result.value.book;
    console.log(`---- ${filePath}:`);
    if (reportMeta) {
        console.log('Tags:');
        console.log(book.tags);
    }
    const bookText = extractNodeText(book.volume);
    console.log(`Book length: ${bookText && bookText.length} symbols`);
    if (result.diagnostic) {
        const top = topDiagnostic(result.diagnostic, 10);
        logRed('Diagnostics:');
        console.log(inspect(result.diagnostic, false, 10, true));
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

function logRed(message: string) {
    console.log(`\x1b[31m${message}\x1b[0m`);
}

async function logTimeAsync(marker: string, f: () => Promise<void>) {
    console.log(`Start: ${marker}`);
    const start = new Date();
    await f();
    const finish = new Date();
    console.log(`Finish: ${marker}, ${finish.valueOf() - start.valueOf()}ms`);
}

export async function wait(n: number) {
    return new Promise(res => setTimeout(() => res(), n));
}
