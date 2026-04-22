#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const METADATA_DIR = path.join(__dirname, '../metadata');
const OUTPUT_DIR = path.join(__dirname, '../apps');
const TEMPLATES_DIR = path.join(__dirname, './templates');
const LOCALE = 'en-US';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read template files
const indexTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'index-template.html'), 'utf8');
const detailTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'detail-template.html'), 'utf8');

// Get all flavor folders
function getFlavors() {
  const flavors = [];
  const dirs = fs.readdirSync(METADATA_DIR);
  
  for (const dir of dirs) {
    const flavorPath = path.join(METADATA_DIR, dir, LOCALE);
    if (fs.existsSync(flavorPath) && fs.statSync(flavorPath).isDirectory()) {
      flavors.push({
        name: dir,
        path: flavorPath
      });
    }
  }
  
  return flavors.sort();
}

// Parse metadata for a flavor
function parseMetadata(flavorPath) {
  const metadata = {
    title: '',
    shortDescription: '',
    fullDescription: '',
    video: '',
    screenshots: {}
  };
  
  // Read title
  const titlePath = path.join(flavorPath, 'title.txt');
  if (fs.existsSync(titlePath)) {
    metadata.title = fs.readFileSync(titlePath, 'utf8').trim();
  }
  
  // Read short description
  const shortDescPath = path.join(flavorPath, 'short_description.txt');
  if (fs.existsSync(shortDescPath)) {
    metadata.shortDescription = fs.readFileSync(shortDescPath, 'utf8').trim();
  }
  
  // Read full description
  const fullDescPath = path.join(flavorPath, 'full_description.txt');
  if (fs.existsSync(fullDescPath)) {
    metadata.fullDescription = fs.readFileSync(fullDescPath, 'utf8').trim();
  }
  
  // Read video
  const videoPath = path.join(flavorPath, 'video.txt');
  if (fs.existsSync(videoPath)) {
    const videoContent = fs.readFileSync(videoPath, 'utf8').trim();
    metadata.video = videoContent;
  }
  
  // Discover screenshots
  const imagesDir = path.join(flavorPath, 'images');
  const deviceTypes = ['phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots', 'tvScreenshots', 'wearScreenshots'];
  
  for (const deviceType of deviceTypes) {
    const deviceDir = path.join(imagesDir, deviceType);
    if (fs.existsSync(deviceDir)) {
      const files = fs.readdirSync(deviceDir)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/\d+/)?.[0] || 0);
          const bNum = parseInt(b.match(/\d+/)?.[0] || 0);
          return aNum - bNum;
        });
      
      if (files.length > 0) {
        metadata.screenshots[deviceType] = files;
      }
    }
  }
  
  return metadata;
}

// Generate YouTube embed URL from various formats
function getYouTubeEmbedUrl(videoText) {
  if (!videoText) return null;
  
  // Handle full URL: https://youtube.com/watch?v=abc123
  const urlMatch = videoText.match(/v=([a-zA-Z0-9_-]{11})/);
  if (urlMatch) {
    return `https://www.youtube.com/embed/${urlMatch[1]}`;
  }
  
  // Handle video ID only: abc123
  if (/^[a-zA-Z0-9_-]{11}$/.test(videoText.trim())) {
    return `https://www.youtube.com/embed/${videoText.trim()}`;
  }
  
  // Handle short URL: https://youtu.be/abc123
  const shortMatch = videoText.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }
  
  return null;
}

// Generate HTML for app cards (for index page)
function generateAppCard(flavor, metadata, index) {
  const displayName = flavor.name.charAt(0).toUpperCase() + flavor.name.slice(1);
  const primaryImage = metadata.screenshots.phoneScreenshots?.[0] || '../images/appsdroid_icon_512x512.png';
  const imagePath = primaryImage === '../images/appsdroid_icon_512x512.png' 
    ? primaryImage 
    : `../metadata/${flavor.name}/${LOCALE}/images/phoneScreenshots/${primaryImage}`;
  
  return `
    <a class="card" href="app-${flavor.name}.html" style="animation-delay:${(index * 0.07).toFixed(2)}s">
      <img class="card-logo" src="${imagePath}" alt="${metadata.title}" loading="lazy"/>
      <div class="card-body">
        <div class="card-title">${metadata.title}</div>
        <div class="card-pkg">${displayName} Radio</div>
        <div class="card-footer">
          <span class="status-live">Live</span>
        </div>
      </div>
    </a>`;
}

// Generate screenshots HTML for detail page
function generateScreenshotsSection(metadata) {
  if (Object.keys(metadata.screenshots).length === 0) {
    return '';
  }
  
  const deviceLabels = {
    phoneScreenshots: 'Phone',
    sevenInchScreenshots: '7-inch Tablet',
    tenInchScreenshots: '10-inch Tablet',
    tvScreenshots: 'TV',
    wearScreenshots: 'Wearable'
  };
  
  let html = '<section class="screenshots-section">\n<h3>Screenshots</h3>\n';
  html += '<div class="device-tabs">';
  
  // Tabs
  const devices = Object.keys(metadata.screenshots);
  devices.forEach((device, idx) => {
    const isActive = idx === 0 ? 'active' : '';
    html += `<button class="tab-btn ${isActive}" data-device="${device}">${deviceLabels[device]}</button>`;
  });
  
  html += '</div>';
  
  // Screenshot galleries
  devices.forEach((device, idx) => {
    const isActive = idx === 0 ? 'active' : '';
    html += `<div class="screenshots-gallery ${isActive}" data-device="${device}">`;
    
    metadata.screenshots[device].forEach(screenshot => {
      const imagePath = `../metadata/${metadata._flavor}/${LOCALE}/images/${device}/${screenshot}`;
      html += `<img src="${imagePath}" alt="Screenshot" class="screenshot" loading="lazy"/>`;
    });
    
    html += '</div>';
  });
  
  html += '</section>\n';
  return html;
}

// Generate video section
function generateVideoSection(metadata) {
  if (!metadata.video) {
    return '';
  }
  
  const embedUrl = getYouTubeEmbedUrl(metadata.video);
  if (!embedUrl) {
    return '';
  }
  
  return `
    <section class="video-section">
      <h3>Video</h3>
      <div class="video-container">
        <iframe 
          width="100%" 
          height="400" 
          src="${embedUrl}" 
          title="App Video"
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
    </section>`;
}

// Generate detail page HTML
function generateDetailPage(flavor, metadata) {
  metadata._flavor = flavor.name;
  const displayName = flavor.name.charAt(0).toUpperCase() + flavor.name.slice(1);
  const primaryImage = metadata.screenshots.phoneScreenshots?.[0] || '../images/appsdroid_icon_512x512.png';
  const imagePath = primaryImage === '../images/appsdroid_icon_512x512.png' 
    ? primaryImage 
    : `../metadata/${flavor.name}/${LOCALE}/images/phoneScreenshots/${primaryImage}`;
  
  let html = detailTemplate;
  
  // Replace placeholders (use replaceAll to handle multiple occurrences)
  html = html.replaceAll('{{FLAVOR_NAME}}', displayName);
  html = html.replaceAll('{{TITLE}}', metadata.title);
  html = html.replaceAll('{{SHORT_DESCRIPTION}}', metadata.shortDescription);
  html = html.replaceAll('{{APP_IMAGE}}', imagePath);
  
  // Generate sections
  let sectionsHtml = '';
  
  // Full description
  if (metadata.fullDescription) {
    sectionsHtml += `<section class="description-section">
      <h3>About</h3>
      <p>${metadata.fullDescription}</p>
    </section>\n`;
  }
  
  // Screenshots
  sectionsHtml += generateScreenshotsSection(metadata);
  
  // Video
  sectionsHtml += generateVideoSection(metadata);
  
  html = html.replaceAll('{{CONTENT_SECTIONS}}', sectionsHtml);
  
  return html;
}

// Main build process
console.log('🔨 Building dynamic site...\n');

const flavors = getFlavors();
console.log(`Found ${flavors.length} flavors with ${LOCALE} metadata:\n`);

if (flavors.length === 0) {
  console.error(`❌ No flavors found with ${LOCALE} metadata!`);
  process.exit(1);
}

// Parse all metadata
const appData = [];
for (const flavor of flavors) {
  try {
    const metadata = parseMetadata(flavor.path);
    appData.push({ flavor, metadata });
    console.log(`✅ ${flavor.name.padEnd(15)} - ${metadata.title}`);
  } catch (err) {
    console.error(`❌ ${flavor.name}: ${err.message}`);
  }
}

console.log(`\n📝 Generating HTML files...\n`);

// Generate index page
let indexHtml = indexTemplate;
let cardsHtml = '';

appData.forEach((data, idx) => {
  cardsHtml += generateAppCard(data.flavor, data.metadata, idx);
});

indexHtml = indexHtml.replace('{{APP_CARDS}}', cardsHtml);

const indexPath = path.join(OUTPUT_DIR, 'index.html');
fs.writeFileSync(indexPath, indexHtml);
console.log(`✅ Generated: /apps/index.html`);

// Generate detail pages
appData.forEach((data) => {
  const detailHtml = generateDetailPage(data.flavor, data.metadata);
  const detailPath = path.join(OUTPUT_DIR, `app-${data.flavor.name}.html`);
  fs.writeFileSync(detailPath, detailHtml);
  console.log(`✅ Generated: /apps/app-${data.flavor.name}.html`);
});

console.log(`\n✨ Build complete! ${appData.length + 1} files generated.\n`);
console.log(`📂 Output directory: /apps/`);
console.log(`🌐 Access at: https://username.github.io/apps/\n`);
