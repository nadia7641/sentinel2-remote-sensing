// === ASCIANO PISANO BURN SEVERITY MAPPING ===
// Pre-fire: 2026-04-27 | Post-fire: 2026-05-02

// 1. DEFINE AOI
var aoi = geometry2;

// 2. LOAD SENTINEL-2 L2A
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');

// 3. FILTER TO YOUR DATES
var pre = s2
  .filterBounds(aoi)
  .filterDate('2026-04-26', '2026-04-28')
  .mosaic()
  .clip(aoi);

var post = s2
  .filterBounds(aoi)
  .filterDate('2026-05-01', '2026-05-03')
  .mosaic()
  .clip(aoi);

// 4. CALCULATE NBR
var nbr_pre = pre.normalizedDifference(['B8', 'B12']).rename('NBR_pre');
var nbr_post = post.normalizedDifference(['B8', 'B12']).rename('NBR_post');

// 5. CALCULATE dNBR
var dnbr = nbr_pre.subtract(nbr_post).rename('dNBR');

// 6. CLASSIFY SEVERITY
var severity = dnbr
  .where(dnbr.lt(0.27), 0)
  .where(dnbr.gte(0.27).and(dnbr.lt(0.44)), 2)
  .where(dnbr.gte(0.44).and(dnbr.lt(0.66)), 3)
  .where(dnbr.gte(0.66), 4);

// 7. MASK OUT NOISE
var burnMask = dnbr.gt(0.27);
var severityMasked = severity.updateMask(burnMask);
var dnbrMasked = dnbr.updateMask(burnMask);

// 8. CLIP FIRE LAYERS ONLY TO GEOMETRY
var severityClipped = severityMasked.clip(geometry);
var dnbrClipped = dnbrMasked.clip(geometry);

// 9. DISPLAY
Map.centerObject(aoi, 12);

Map.addLayer(pre, {bands: ['B4','B3','B2'], min:0, max:3000}, 'Pre-fire True Color');
Map.addLayer(post, {bands: ['B4','B3','B2'], min:0, max:3000}, 'Post-fire True Color');
Map.addLayer(dnbrClipped, {min:0.27, max:1.3, palette:['orange','red','darkred']}, 'dNBR');
Map.addLayer(severityClipped, {min:2, max:4, palette:['orange','red','darkred']}, 'Burn Severity');

// 10. EXPORT BURN SEVERITY TO GOOGLE DRIVE
Export.image.toDrive({
  image: severityClipped.toInt(),
  description: 'MonteFaeta_BurnSeverity',
  folder: 'GEE_Exports',
  fileNamePrefix: 'MonteFaeta_BurnSeverity',
  region: aoi,
  scale: 20,
  crs: 'EPSG:32632',
  maxPixels: 1e9
});
