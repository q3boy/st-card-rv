import * as Vue from 'vue';
import { buildNpcAuthor } from '../../scripts/author-build';

export const authorSource = await buildNpcAuthor();
export const authorGlobals = { Vue };
