/* global mobilenet, cocoSsd, faceapi */

let classifierV1;
let classifierV2;
let detector;
const images = [];

async function log(msg) {
  const div = document.getElementById('log');
  div.innerHTML += `${msg}<br>`;
}

async function loadImage(imageUrl) {
  return new Promise((resolve) => {
    try {
      const image = new Image();
      // image.onLoad = () => {
      image.loading = 'eager';
      image.onerror = () => log(`Error loading image: ${imageUrl}`);
      image.addEventListener('load', () => {
        /* resize if too large for processing
        const ratio = image.height / image.width;
        if (image.width > 1048 || image.height > 1048) {
          image.width = 1024;
          image.height = image.width * ratio;
        }
        */
        resolve(image);
      });
      image.src = imageUrl;
    } catch (err) {
      log(`Error loading image: ${imageUrl} ${err}`);
      resolve(null);
    }
  });
}

async function loadModels() {
  log('Initializing TensorFlowJS...');
  // load TF MobileNet Classifier model
  const t0 = window.performance.now();
  classifierV1 = await mobilenet.load({ version: 1, alpha: 1.0, modelUrl: 'models/mobilenet-v1/model.json' });
  classifierV2 = await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: 'models/mobilenet-v2/model.json' });
  detector = await cocoSsd.load({ base: 'mobilenet_v2', modelUrl: 'models/cocossd-v2/model.json' });
  await faceapi.nets.ssdMobilenetv1.load('models/faceapi/');
  await faceapi.loadFaceLandmarkModel('models/faceapi/');
  await faceapi.nets.ageGenderNet.load('models/faceapi/');
  await faceapi.loadFaceExpressionModel('models/faceapi/');
  log(`Models loaded in ${(window.performance.now() - t0).toLocaleString()}ms`);
}

async function processPerson(image) {
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
  const result = await faceapi.detectSingleFace(image, options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender();
  if (result) {
    let emotion = Object.entries(result.expressions)
      .reduce(([keyPrev, valPrev], [keyCur, valCur]) => (valPrev > valCur ? [keyPrev, valPrev] : [keyCur, valCur]));
    emotion = { label: emotion && emotion[0] ? emotion[0] : '', confidence: emotion && emotion[1] ? emotion[1] : 0 };
    return { gender: { confidence: result.genderProbability, label: result.gender }, age: result.age, emotion: { confidence: emotion.confidence, label: emotion.label } };
  }
  return null;
}

async function processImage(image) {
  log(`Processing image: ${image.src} ${image.width}x${image.height}`);
  try {
    const t0 = window.performance.now();
    const classifiedV1 = classifierV1 ? await classifierV1.classify(image) : null;
    const classifiedV2 = classifierV2 ? await classifierV2.classify(image) : null;
    const detected = detector ? await detector.detect(image) : null;
    const found = detected.find((a) => a.class === 'person');
    let person;
    if (found) person = await processPerson(image);
    images.push({ image: image.src, time: (window.performance.now() - t0), classifiedV1, classifiedV2, detected, person });
  } catch (err) {
    log(`Error processing image: ${image.src}: ${err}`);
  }
}

function printObject(objects) {
  if (!objects) return '';
  let text = '';
  const arr = Array.isArray(objects) ? objects : [objects];
  for (const obj of arr) {
    if (obj.age) text += `${(100 * (obj.gender.confidence).toFixed(2))}% ${obj.gender.label} age:${obj.age.toFixed(2)}y emotion:${(100 * (obj.emotion.confidence).toFixed(2))}% ${obj.emotion.label}`;
    else text += `${(100 * (obj.probability || obj.score)).toFixed(2)}% ${(obj.className || obj.class)} | `;
  }
  return text;
}
async function printResults() {
  log('Processing results...');
  let text = '';
  for (const img of images) {
    text += '<div class="row">';
    text += ` <div class="col" style="height: 150px; min-width: 150px; max-width: 150px"><img src="${img.image}" width="140" height="140"></div>`;
    text += ' <div class="col">';
    text += `  <div>Image ${img.image} processed in ${img.time.toFixed(0)}ms </div>`;
    text += `  <div>ClassificationV1: ${printObject(img.classifiedV1)}</div>`;
    text += `  <div>ClassificationV2: ${printObject(img.classifiedV2)}</div>`;
    text += `  <div>Detected: ${printObject(img.detected)}</div>`;
    text += `  <div>Person: ${printObject(img.person)}</div>`;
    text += ' </div>';
    text += '</div>';
  }
  document.getElementById('result').innerHTML = text;
}

async function loadGallery() {
  for (let i = 1; i < 12; i++) { // 58
    const image = await loadImage(`/samples/sample%20(${i}).jpg`);
    if (image) {
      await processImage(image);
      image.remove();
    }
  }
}

async function main() {
  await loadModels();
  await loadGallery();
  await printResults();
}

main();
