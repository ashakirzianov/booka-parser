#! /usr/bin/env node
// tslint:disable: no-console
import * as fs from 'fs';
import { extname, join, dirname, basename } from 'path';
import { parseEpub } from '.';
import { promisify, inspect } from 'util';
import { extractNodeText, tagValue, Book } from 'booka-common';
import { topDiagnostic } from './combinators';
import { parseEpubText } from './epub';

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
            await processEpubFile(epubPath, reportMeta ? 2 : 1);
        }
    });
}

async function processEpubFile(filePath: string, verbosity: number = 0) {
    const result = await parseEpub({ filePath });
    if (!result.success) {
        if (verbosity > -1) {
            logRed(`Couldn't parse epub: '${filePath}'`);
            console.log(result.diagnostic);
        }
        return;
    }
    const book = result.value.book;
    if (verbosity > -1) {
        console.log(`---- ${filePath}:`);
    }
    const pathToSave = join(dirname(filePath), `${basename(filePath, '.epub')}.booka`);
    await saveBook(pathToSave, book);
    if (verbosity > 1) {
        console.log('Tags:');
        console.log(book.tags);
    }
    const bookText = extractNodeText(book.volume);
    const allXmlText = await parseEpubText(filePath);
    const ratio = Math.floor(bookText.length / allXmlText.length * 100);
    if (verbosity > 0) {
        console.log(`Book length: ${bookText.length} symbols, ratio: ${ratio}`);
    }
    if (ratio < 97) {
        if (verbosity > -1) {
            logRed('Low ratio');
        }
        await saveString(`${filePath}.original`, allXmlText);
        await saveString(`${filePath}.parsed`, bookText);
    }
    const skipTag = tagValue(result.value.book.tags, 'pg-skip');
    if (skipTag !== null && verbosity > -1) {
        logYellow('SKIP');
    }
    if (result.diagnostic) {
        if (verbosity > -1) {
            logRed('Diagnostics:');
            console.log(inspect(result.diagnostic, false, 8, true));
        } else if (verbosity > -2) {
            console.log(filePath);
        }

    }

    return result.diagnostic;
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

function logYellow(message: string) {
    console.log(`\x1b[33m${message}\x1b[0m`);
}

async function logTimeAsync(marker: string, f: () => Promise<void>) {
    console.log(`Start: ${marker}`);
    const start = new Date();
    await f();
    const finish = new Date();
    console.log(`Finish: ${marker}, ${finish.valueOf() - start.valueOf()}ms`);
}

async function saveString(path: string, content: string) {
    return promisify(fs.writeFile)(path, content);
}

async function saveBook(path: string, book: Book) {
    const str = JSON.stringify({ book });
    return saveString(path, str);
}

export async function wait(n: number) {
    return new Promise(res => setTimeout(() => res(), n));
}
