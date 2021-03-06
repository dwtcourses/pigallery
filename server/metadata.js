// @ts-nocheck

const fs = require('fs');
const path = require('path');
const proc = require('process');
const crypto = require('crypto');
const moment = require('moment');
const exif = require('jpeg-exif');
const parser = require('exif-parser');
const log = require('@vladmandic/pilogger');
// const nedb = require('nedb-promises');
const distance = require('./nearest.js');

let wordNet = {};

async function init() {
  let data;
  data = fs.readFileSync(global.config.server.descriptionsDB, 'utf8');
  let terms = 0;
  for (const line of data.split('\n')) {
    if (line.includes('_wnid')) terms++;
  }
  wordNet = JSON.parse(data);
  log.state('Loaded WordNet database:', global.config.server.descriptionsDB, terms, 'terms in', data.length, 'bytes');
  data = fs.readFileSync(global.config.server.citiesDB);
  const cities = JSON.parse(data);
  const large = cities.data.filter((a) => a.population > 100000);
  log.state('Loaded all cities database:', global.config.server.citiesDB, cities.data.length, 'all cities', large.length, 'large cities');
  distance.init(cities.data, large);
  data = null;
}

function storeObject(data) {
  if (data.image === global.config.server.warmupImage) return;
  const json = data;
  json.processed = new Date();
  global.db.update({ image: json.image }, json, { upsert: true });
  log.data(`DB Insert "${json.image}"`, JSON.stringify(json).length, 'bytes');
}

function buildTags(object) {
  const tags = [];
  const filePart = object.image.split('/');
  for (const name of filePart) tags.push({ name: name.toLowerCase() });
  const fileExt = object.image.split('.');
  tags.push({ ext: fileExt[fileExt.length - 1].toLowerCase() });
  if (object.pixels) {
    let size;
    if (object.pixels / 1024 / 1024 > 40) size = 'huge';
    else if (object.pixels / 1024 / 1024 > 10) size = 'large';
    else if (object.pixels / 1024 / 1024 > 1) size = 'medium';
    else size = 'small';
    tags.push({ size });
  }
  let found;
  found = [];
  for (const obj of object.classify) {
    if (!found.includes(obj.class)) {
      found.push(obj.class);
      tags.push({ classified: obj.class });
    }
  }
  found = [];
  for (const obj of object.detect) {
    if (!found.includes(obj.class)) {
      found.push(obj.class);
      tags.push({ detected: obj.class });
    }
  }
  found = [];
  for (const obj of object.descriptions) {
    for (const line of obj) {
      if (!found.includes(line.name)) {
        found.push(line.name);
        tags.push({ desc: line.name });
      }
    }
  }
  if (object.person && object.person.length > 0) {
    for (const person of object.person) {
      let age;
      if (person.age < 10) age = 'kid';
      else if (person.age < 20) age = 'teen';
      else if (person.age < 30) age = '20ies';
      else if (person.age < 40) age = '30ies';
      else if (person.age < 50) age = '40ies';
      else if (person.age < 60) age = '50ies';
      else if (person.age < 100) age = 'old';
      else age = 'uknown';
      tags.push({ property: 'face' });
      tags.push({ gender: person.gender }, { emotion: person.emotion }, { age });
    }
  }
  if (object.exif && object.exif.created) {
    tags.push({ property: 'exif' });
    if (object.exif.make) tags.push({ camera: object.exif.make.toLowerCase() });
    if (object.exif.model) tags.push({ camera: object.exif.model.toLowerCase() });
    if (object.exif.lens) tags.push({ lens: object.exif.lens.toLowerCase() });
    if (object.exif.created) tags.push({ created: new Date(object.exif.created) });
    if (object.exif.created) tags.push({ year: new Date(object.exif.created).getFullYear() });
    if (object.exif.modified) tags.push({ edited: new Date(object.exif.modified) });
    if (object.exif.software) tags.push({ software: object.exif.software.toLowerCase() });
    if (object.exif.iso && object.exif.apperture && object.exif.exposure) {
      const conditions = object.exif.iso / (object.exif.apperture ** 2) * object.exif.exposure;
      if (conditions < 0.01) tags.push({ conditions: 'bright' }, { conditions: 'outdoors' });
      else if (conditions < 0.1) tags.push({ conditions: 'outdoors' });
      else if (conditions < 5) tags.push({ conditions: 'indoors' });
      else if (conditions < 20) tags.push({ conditions: 'night' });
      else tags.push({ conditions: 'night' }, { conditions: 'long' });
    }
    if (object.exif.fov) {
      if (object.exif.fov > 200) tags.push({ zoom: 'superzoom' }, { zoom: 'zoom' });
      else if (object.exif.fov > 100) tags.push({ zoom: 'zoom' });
      else if (object.exif.fov > 40) tags.push({ zoom: 'portrait' });
      else if (object.exif.fov > 20) tags.push({ zoom: 'wide' });
      else tags.push({ zoom: 'wide' }, { zoom: 'ultrawide' });
    }
  }
  if (object.location && object.location.city) {
    tags.push(
      { city: object.location.city.toLowerCase() },
      { state: object.location.state.toLowerCase() },
      { country: object.location.country.toLowerCase() },
      { continent: object.location.continent.toLowerCase() },
      { near: object.location.near.toLowerCase() },
    );
  }
  return tags;
}

function searchClasses(wnid) {
  const res = [];
  if (wnid === '') return res;
  // eslint-disable-next-line consistent-return
  function recursive(obj) {
    for (const item of obj) {
      if (item._wnid === wnid) return res.push({ id: item._wnid, name: item._words, desc: item._gloss });
      if (item.synset && recursive(item.synset)) return res.push({ id: item._wnid, name: item._words, desc: item._gloss });
    }
  }
  recursive(wordNet.ImageNetStructure.synset[0].synset);
  return res;
}

function getDescription(image) {
  const results = [];
  const found = [];
  const ids = [];
  for (const item of image.classify) {
    if (!found.includes(item.class)) {
      found.push(item.class);
      ids.push(item.wnid);
    }
  }
  for (const id of ids) {
    const descriptions = searchClasses(id);
    const lines = [];
    for (const description of descriptions) {
      if (description.name) lines.push({ name: description.name, desc: description.desc });
    }
    if (lines.length > 0) {
      if (lines.length > 3) lines.length = 3;
      results.push(lines);
    }
  }
  return results;
}

function getLocation(json) {
  if (!json.lon || !json.lat) return {};
  const loc = distance.nearest(json.lat, json.lon, 'all', 1);
  const near = distance.nearest(json.lat, json.lon, 'large', 1);
  const state = isNaN(loc[0].state) ? loc[0].state : '';
  const res = { city: loc[0].name, near: near[0].name, state, country: loc[0].country, continent: loc[0].continent };
  return res;
}

function getTime(time) {
  if (!time) return null;
  let t;
  if (time.toString().match(/[^\d]/)) {
    t = moment(time, 'YYYY:MM:DD HH:mm:ss');
    if (!t.isValid()) t = new Date(time);
    else t = t.toDate();
  } else {
    t = new Date(parseInt(time));
  }
  if (t.getFullYear() < 1971) t = new Date(1000 * parseInt(time));
  return t.getTime();
}

function parseExif(chunk, tries) {
  let raw;
  let error = false;
  try {
    raw = parser.create(chunk).parse();
  } catch {
    error = true;
  }
  if (error && tries > 0) raw = parseExif(chunk, tries - 1);
  const tags = raw ? raw.tags : {};
  return tags;
}

async function getExif(url) {
  return new Promise((resolve) => {
    const json = {};
    if (!fs.existsSync(url)) resolve(json);
    const stat = fs.statSync(url);
    json.bytes = stat.size;
    json.ctime = stat.ctime;
    json.mtime = stat.mtime;
    let chunk = Buffer.alloc(0);
    if (url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
      // const stream = fs.createReadStream(url, { highWaterMark: 4 * 1024 * 1024 });
      const stream = fs.createReadStream(url, { highWaterMark: 65536, start: 0, end: 65535, flags: 'r', autoClose: true, emitClose: true });
      stream
        .on('data', (buf) => {
          chunk = Buffer.concat([chunk, buf]);
          if (chunk.length >= 65536) {
            stream.close();
          }
        })
        .on('close', () => {
          const meta1 = parseExif(chunk, 10) || {};
          let meta2;
          try {
            meta2 = exif.fromBuffer(chunk) || {};
          } catch {
            meta2 = {};
          }
          if (!meta2.SubExif) meta2.SubExif = {};
          if (!meta2.GPSInfo) meta2.GPSInfo = {};
          json.make = meta1.Make || meta2.Make;
          json.model = meta1.Model || meta2.Model;
          json.lens = meta1.LensModel || meta2.SubExif.LensModel;
          json.software = meta1.Software || meta2.Software;
          json.created = getTime(meta1.CreateDate || meta1.DateTimeOriginal || meta2.DateTime || meta2.SubExif.DateTimeOriginal || meta2.GPSInfo.GPSDateStamp) || undefined;
          json.modified = getTime(meta1.ModifyDate) || undefined;
          json.exposure = meta1.ExposureTime || (meta2.SubExif.ExposureTime ? meta2.SubExif.ExposureTime[0] : undefined);
          json.apperture = meta1.FNumber || (meta2.SubExif.FNumber ? meta2.SubExif.FNumber[0] : undefined);
          json.iso = meta1.ISO || meta2.SubExif.ISO || meta2.SubExif.PhotographicSensitivity;
          json.fov = meta1.FocalLengthIn35mmFilm || meta2.SubExif.FocalLengthIn35mmFilm;
          const west = meta2.GPSInfo.GPSLongitudeRef === 'W' ? -1 : 1;
          json.lat = meta1.GPSLatitude || (meta2.GPSInfo.GPSLatitude ? (meta2.GPSInfo.GPSLatitude[0] || 0) + ((meta2.GPSInfo.GPSLatitude[1] || 0) / 60) + ((meta2.GPSInfo.GPSLatitude[2] || 0) / 3600) : undefined);
          json.lon = meta1.GPSLongitude || (meta2.GPSInfo.GPSLongitude ? west * (meta2.GPSInfo.GPSLongitude[0] || 0) + ((meta2.GPSInfo.GPSLongitude[1] || 0) / 60) + ((meta2.GPSInfo.GPSLongitude[2] || 0) / 3600) : undefined);
          json.width = meta1.ImageWidth || meta1.ExifImageWidth || meta2.ImageWidth || meta2.SubExif.PixelXDimension || null;
          json.height = meta1.ImageHeight || meta1.ExifImageHeight || meta2.ImageHeight || meta2.SubExif.PixelYDimension || null;
          if (!json.width) json.width = meta1.XResolution || meta2.XResolution || undefined;
          if (!json.height) json.height = meta1.YResolution || meta2.YResolution || undefined;
          json.unit = (meta1.ResolutionUnit || meta2.ResolutionUnit) === 2 ? 'inch' : 'cm';
          resolve(json);
        })
        .on('error', (err) => {
          log.warn('EXIF Error', err);
          resolve(json);
        });
    }
  });
}

async function getHash(file, hashType) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return new Promise((resolve) => {
    const stream = fs.createReadStream(file, { highWaterMark: 4 * 16 * 65536 });
    stream.on('data', (chunk) => {
      const digest = crypto
        .createHash(hashType)
        .update(chunk)
        .digest('hex');
      stream.close();
      resolve(digest);
    });
  });
}

function readDir(folder, match = null, recursive = false) {
  let files = [];
  try {
    if (!fs.existsSync(folder)) return files;
    const dir = fs.readdirSync(folder);
    for (const file of dir) {
      const name = path.join(folder, file);
      const stat = fs.statSync(name);
      if (stat.isFile()) {
        if (global.config.exclude.includes(file)) log.info('FS Exclude:', name);
        else if (match) {
          if (name.includes(match)) files.push(name);
        } else {
          files.push(name);
        }
      }
      if (stat.isSymbolicLink()) {
        const subdir = readDir(name, match, recursive);
        files = [...files, ...subdir];
      }
      if (stat.isDirectory()) {
        if (recursive) {
          const subdir = readDir(name, match, recursive);
          files = [...files, ...subdir];
        }
      }
    }
  } catch (err) {
    log.warn('FS Error', folder, err);
  }
  return files;
}

async function listFiles(folder, match = '', recursive = false, force = false) {
  let files = readDir(`${global.config.server.mediaRoot}${folder}`, match, recursive);
  files = files.filter((a) => {
    for (const ext of global.config.server.allowedImageFileTypes) {
      if (a.toLowerCase().endsWith(ext)) return true;
    }
    return false;
  });
  let process = [];
  let processed = 0;
  let updated = 0;
  if (force) {
    process = files;
  } else {
    for (const a of files) {
      const image = await global.db.find({ image: a });
      if (image && image[0]) {
        const stat = fs.statSync(a);
        if (stat.ctime.getTime() !== image[0].exif.ctime.getTime()) {
          log.data(`FS ctime updated ${a} ${image[0].exif.ctime} ${stat.ctime}`);
          process.push(a);
          updated++;
        } else if (stat.mtime.getTime() !== image[0].exif.mtime.getTime()) {
          log.data(`FS mtime updated ${a} ${image[0].exif.mtime} ${stat.mtime}`);
          process.push(a);
          updated++;
        } else processed++;
      } else {
        process.push(a);
      }
    }
  }
  log.info(`FS Lookup ${folder} matching:${match || '*'} recursive: ${recursive} force: ${force} results: ${files.length} processed: ${processed} updated: ${updated} queued: ${process.length}`);
  return { files, process };
}

async function checkRecords(list) {
  let all = await global.db.find({ hash: { $exists: true } });
  all = all.map((a) => a.image);
  const deleted = all.filter((a) => !list.includes(a));
  for (const item of deleted) {
    log.data('Delete:', item);
    global.db.remove({ image: item });
  }
  const before = all.length;
  const after = await global.db.count({});
  if (deleted.length > 0) log.info(`DB Remove ${deleted.length} deleted images from cache (before: ${before}, after: ${after})`);
}

async function testExif(dir) {
  // eslint-disable-next-line no-console
  console.log('Test', dir);
  await init();
  /*
  global.db = nedb.create({ filename: global.config.server.db, inMemoryOnly: false, timestampData: true, autoload: false });
  await global.db.loadDatabase();
  const list = [];
  let filesAll = [];
  for (const location of global.config.locations) {
    const folder = await listFiles(location.folder, location.match, location.recursive, location.force);
    list.push({ location, files: folder.process });
    filesAll = [...filesAll, ...folder.files];
  }
  console.log('list', list);
  console.log('all', filesAll);
  */
  if (fs.statSync(dir).isFile()) {
    const data = await getExif(dir);
    const geo = await getLocation(data);
    // eslint-disable-next-line no-console
    console.log(dir, data, geo);
  } else {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const data = await getExif(path.join(dir, file));
      const geo = await getLocation({ lat: data.lat, lon: data.lon });
      // eslint-disable-next-line no-console
      console.log(path.join(dir, file), geo, data);
    }
  }
}

exports.init = init;
exports.descriptions = getDescription;
exports.location = getLocation;
exports.exif = getExif;
exports.hash = getHash;
exports.tags = buildTags;
exports.store = storeObject;
exports.list = listFiles;
exports.check = checkRecords;

if (require.main === module) {
  testExif(proc.argv[2]);
}
