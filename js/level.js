// Level 1. Everything is in beats; bpm + offset turn beats into seconds.
// Change bpm or offset here and the whole level (music, enemies, traps) follows.
// Tiles: # wall  . floor  ^ spikes (up on even beats)  | gate (open 2 beats, shut 2)
//        P player start  E exit stairs (unseal at exitBeat)
import { SONG_BEATS, SONG_TITLE } from './music.js';

export const LEVEL = {
  name: 'The Ticking Crypt',
  song: SONG_TITLE,
  bpm: 120,
  offset: 0,          // seconds from song start to chart beat 0
  beats: SONG_BEATS,  // 256 beats = 2:08
  exitBeat: 224,      // stairs open for the outro
  layers: { drums: 4, bass: 12, melody: 24 }, // combo needed for each stem
  map: [
    '####################',
    '#P.....#.....^.....#',
    '#......|.....^.....#',
    '#..##..#..######...#',
    '#..##..#...........#',
    '#......####..^^....#',
    '#..^^..............#',
    '#.........###..##..#',
    '######.|..#........#',
    '#.......^.#...##...#',
    '#.........|.....E..#',
    '####################',
  ],
  // waves line up with the song sections (intro 0, A 32, B 96, breakdown 160, A' 192)
  spawns: [
    { beat: 0, type: 'slime', x: 5, y: 6 },
    { beat: 0, type: 'slime', x: 16, y: 4 },
    { beat: 32, type: 'bat', x: 10, y: 1 },
    { beat: 32, type: 'bat', x: 16, y: 2 },
    { beat: 32, type: 'skeleton', x: 12, y: 4 },
    { beat: 64, type: 'skeleton', x: 3, y: 9 },
    { beat: 64, type: 'bat', x: 8, y: 6 },
    { beat: 96, type: 'skeleton', x: 14, y: 8 },
    { beat: 96, type: 'skeleton', x: 5, y: 2 },
    { beat: 96, type: 'bat', x: 12, y: 10 },
    { beat: 96, type: 'bat', x: 2, y: 1 },
    { beat: 128, type: 'slime', x: 17, y: 9 },
    { beat: 128, type: 'bat', x: 9, y: 4 },
    { beat: 128, type: 'skeleton', x: 17, y: 6 },
    { beat: 160, type: 'slime', x: 7, y: 9 },
    { beat: 160, type: 'slime', x: 12, y: 6 },
    { beat: 192, type: 'skeleton', x: 2, y: 6 },
    { beat: 192, type: 'skeleton', x: 18, y: 1 },
    { beat: 192, type: 'skeleton', x: 12, y: 9 },
    { beat: 192, type: 'bat', x: 6, y: 4 },
    { beat: 192, type: 'bat', x: 14, y: 2 },
    { beat: 192, type: 'bat', x: 9, y: 10 },
    { beat: 216, type: 'bat', x: 17, y: 1 },
    { beat: 216, type: 'bat', x: 4, y: 9 },
  ],
};
