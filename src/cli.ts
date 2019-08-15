#! /usr/bin/env node
// tslint:disable: no-console
import { parseEpubAtPath } from '.';

exec();

async function exec() {
    const args = process.argv;
    const path = args[2];
    if (path) {
        const result = await parseEpubAtPath(path);
        console.log(result);
    } else {
        console.log('You need to pass epub path as an arg');
    }
}
