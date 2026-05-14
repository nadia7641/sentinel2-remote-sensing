var aoi = ee.Geometry.Rectangle([8.4, 39.6, 9.9, 40.4]);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate('2023-06-01', '2023-08-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median();

var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');

var image = s2.select(['B2','B3','B4','B8','B11','B12'])
              .addBands(ndvi);

// ── TRAINING POINTS (70%) ──────────────────────────────
var acqua_tr = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([9.2295, 39.7725]), {'classe': 0}),
  ee.Feature(ee.Geometry.Point([8.5908, 39.8672]), {'classe': 0})
]);

var urbano_tr = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([8.5893, 39.9054]), {'classe': 1}),
  ee.Feature(ee.Geometry.Point([9.3539, 40.2041]), {'classe': 1}),
  ee.Feature(ee.Geometry.Point([9.3274, 40.3182]), {'classe': 1}),
  ee.Feature(ee.Geometry.Point([9.2535, 40.1186]), {'classe': 1}),
  ee.Feature(ee.Geometry.Point([8.9395, 39.9476]), {'classe': 1})
]);

var pascolo_tr = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([9.1476, 39.9883]), {'classe': 2}),
  ee.Feature(ee.Geometry.Point([9.3049, 39.9916]), {'classe': 2}),
  ee.Feature(ee.Geometry.Point([8.8639, 39.9621]), {'classe': 2}),
  ee.Feature(ee.Geometry.Point([9.0195, 40.2703]), {'classe': 2}),
  ee.Feature(ee.Geometry.Point([9.0101, 40.2582]), {'classe': 2})
]);

var bosco_tr = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([9.1318, 40.0250]), {'classe': 3}),
  ee.Feature(ee.Geometry.Point([9.1849, 39.9503]), {'classe': 3}),
  ee.Feature(ee.Geometry.Point([9.0998, 39.9393]), {'classe': 3}),
  ee.Feature(ee.Geometry.Point([9.2275, 39.8014]), {'classe': 3}),
  ee.Feature(ee.Geometry.Point([8.8209, 39.9465]), {'classe': 3})
]);

var transizione_tr = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([9.1510, 40.1135]), {'classe': 4}),
  ee.Feature(ee.Geometry.Point([9.2768, 40.0728]), {'classe': 4}),
  ee.Feature(ee.Geometry.Point([9.2873, 40.0736]), {'classe': 4})
]);

var training_points = acqua_tr
  .merge(urbano_tr)
  .merge(pascolo_tr)
  .merge(bosco_tr)
  .merge(transizione_tr);

var training = image.sampleRegions({
  collection: training_points,
  properties: ['classe'],
  scale: 10
});

var classifier = ee.Classifier.smileRandomForest(50).train({
  features: training,
  classProperty: 'classe',
  inputProperties: ['B2','B3','B4','B8','B11','B12','NDVI']
});

var classified = image.classify(classifier);

// ── TEST POINTS (30%) - nessuna sovrapposizione ────────
var test_points = ee.FeatureCollection([
  // Acqua
  ee.Feature(ee.Geometry.Point([8.9095, 40.1319]), {'classe': 0}),
  ee.Feature(ee.Geometry.Point([9.2333, 39.6267]), {'classe': 0}),
  // Urbano
  ee.Feature(ee.Geometry.Point([9.1943, 40.1602]), {'classe': 1}),
  ee.Feature(ee.Geometry.Point([9.1609, 40.0956]), {'classe': 1}),
  ee.Feature(ee.Geometry.Point([9.1703, 40.0238]), {'classe': 1}),
  // Pascolo
  ee.Feature(ee.Geometry.Point([8.8889, 39.9574]), {'classe': 2}),
  ee.Feature(ee.Geometry.Point([9.0465, 40.2588]), {'classe': 2}),
  ee.Feature(ee.Geometry.Point([9.0971, 40.2523]), {'classe': 2}),
  // Bosco
  ee.Feature(ee.Geometry.Point([8.8892, 39.9619]), {'classe': 3}),
  ee.Feature(ee.Geometry.Point([8.9842, 40.0585]), {'classe': 3}),
  ee.Feature(ee.Geometry.Point([9.5533, 40.1372]), {'classe': 3}),
  ee.Feature(ee.Geometry.Point([9.1954, 39.7793]), {'classe': 3}),
  // Transizione
  ee.Feature(ee.Geometry.Point([9.3783, 40.1645]), {'classe': 4})
]);

var test = classified.sampleRegions({
  collection: test_points,
  properties: ['classe'],
  scale: 10
});

var confusionMatrix = test.errorMatrix('classe', 'classification');
print('Matrice di confusione:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());

// ── VISUALIZZAZIONE ────────────────────────────────────
Map.centerObject(aoi, 10);
Map.addLayer(s2, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, 'RGB');
Map.addLayer(ndvi, {min: 0, max: 0.8, palette: ['red', 'yellow', 'green']}, 'NDVI');
Map.addLayer(classified, {
  min: 0, max: 4,
  palette: ['#1a6faf', '#d4a853', '#f5f58a', '#2d6a2d', '#a8c97f']
}, 'Land Cover 5 classi');

print('Classi: 0=acqua 1=urbano 2=pascolo 3=bosco 4=transizione');
// Export della classificazione su Google Drive
// Area ridotta per export - Barbagia originale
var aoi_export = ee.Geometry.Rectangle([9.0, 39.7, 9.8, 40.35]);

Export.image.toDrive({
  image: classified.clip(aoi_export),
  description: 'LandCover_Barbagia_5classi',
  folder: 'GEE_exports',
  fileNamePrefix: 'landcover_barbagia_2023',
  region: aoi_export,
  scale: 10,
  crs: 'EPSG:32632',
  maxPixels: 1e13
});
