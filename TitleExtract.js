const { exec } = require('child_process');

function extractTitle(stderr) {
  const titleMatch = stderr.match(/title\s*:\s*(.*)/);
  const title = titleMatch[1].trim();
  if (title.endsWith("HD")) {
    const regex = /^(.+?)\s+Movie CLIP\s+-\s+.+?\((\d{4})\)/;
    const match = title.match(regex);
    if (match) {
      const name = match[1] ? match[1] : "";
      const year = match[2] ? match[2] : "";
      return `${name} - ${year}`;
    }
  } else if (title.endsWith("Movieclips")) {
    const regex = /^(.+?) \((\d{4})\) - .*? Scene \((\d+\/\d+)\) \| Movieclips$/;
    const match = title.match(regex);
    if (match) {
      const title = match[1] ? match[1] : "";
      const year = match[2] ? match[2] : "";
      const sceneNumber = match[3] ? match[3] : "";
      const output = `${title} (${sceneNumber}) - ${year}`;
      return output;
    }
  }

  return title;
}

function getTitleFromVideo(filePath) {
  return new Promise((resolve, reject) => {
    exec(`ffmpeg -i "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        const title = extractTitle(stderr);
        if (title) {
          resolve(title);
        } else {
          reject('Title not found');
        }
      } else {
        reject('Command failed');
      }
    });
  });
}

module.exports = { getTitleFromVideo };