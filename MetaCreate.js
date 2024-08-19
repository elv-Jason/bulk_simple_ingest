const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const config = JSON.parse(fs.readFileSync('./data/config.json', 'utf8'));
const videoPath = config.videoPath;
const outputJsonPath = config.outputJsonPath;

exec(`ffmpeg -i "${videoPath}" -f null -`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing FFmpeg: ${error.message}`);
    return;
  }

  const output = stderr;
  const metadata = parseFFmpegOutput(output, videoPath);
  const jsonStructure = createJSONStructure(metadata);

  fs.writeFileSync(outputJsonPath, JSON.stringify(jsonStructure, null, 2), 'utf8');
  console.log(`JSON file has been created at: ${outputJsonPath}`);
});

let description = '';
exec(`ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error executing ffprobe: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`ffprobe error: ${stderr}`);
        return;
    }
    const ffprobeOutput = JSON.parse(stdout);
    description = ffprobeOutput.format.tags.description;
});

function parseFFmpegOutput(output, videoPath) {
  const metadata = {};
  const titleMatch = output.match(/title\s*:\s*(.*)/);
  if (titleMatch) metadata.title = titleMatch[1].trim();
  console.log(metadata.title);
  if (metadata.title.endsWith("HD")) {
    const extractedTitleMatch = metadata.title.match(/^(.+?) \(\d+\/\d+\) Movie CLIP - (.+?) \((\d{4})\) HD/);
    if (extractedTitleMatch) {
      metadata.displayTitle = extractedTitleMatch[1] + ' ' + extractedTitleMatch[3];
      metadata.year = extractedTitleMatch[3]
      metadata.query = extractedTitleMatch[2]
    }

    const clipDescriptionMatch = description.match(/CLIP DESCRIPTION:\n([\s\S]*?)\n/)
    if (clipDescriptionMatch) metadata.clipDescription = clipDescriptionMatch[1].trim();

  } else if (metadata.title.endsWith("Movieclips")) {
    const extractedTitleMatch = metadata.title.match(/^(.+?) \((\d{4})\) - (.+?) Scene(?: \((\d+\/\d+)\))? \| Movieclips$/);
    if (extractedTitleMatch) {
      metadata.displayTitle = extractedTitleMatch[1] + ' ' + extractedTitleMatch[2];
      metadata.year = extractedTitleMatch[2]
      metadata.query = extractedTitleMatch[3]
    }

    const clipDescriptionMatch = description.match(/^.*?(?=\n)/)
    if (clipDescriptionMatch) metadata.clipDescription = clipDescriptionMatch[0];
  }

  const durationMatch = output.match(/Duration:\s*(\d{2}:\d{2}:\d{2}\.\d{2})/);
  if (durationMatch) metadata.duration = durationMatch[1].trim();

  const castMatch = output.match(/Cast\s*:\s*(.*)/);
  const directorMatch = output.match(/Director\s*:\s*(.*)/);
  const producersMatch = output.match(/Producers\s*:\s*(.*)/);
  const screenwritersMatch = output.match(/Screenwriters\s*:\s*(.*)/);
  if (castMatch) metadata.cast = castMatch[1].trim().split(', ');
  if (directorMatch) metadata.director = directorMatch[1].trim().split(', ');
  if (producersMatch) metadata.producers = producersMatch[1].trim().split(', ');
  if (screenwritersMatch) metadata.screenwriters = screenwritersMatch[1].trim().split(', ');


  const copyrightMatch = output.match(/: CREDITS:\n\s*:\s*([^:\n]*)/);
  if (copyrightMatch) metadata.copyRight = copyrightMatch[1].trim();
  
  const filmDescriptionMatch = description.match(/FILM DESCRIPTION:\n([\s\S]*?)\n/);
  if (filmDescriptionMatch) metadata.filmDescription = filmDescriptionMatch[1].trim();

  metadata.id = path.basename(videoPath, '.mp4'); 

  return metadata;
}

function createJSONStructure(metadata) {
  const talent = {};

  if (metadata.cast) {
    talent.actor = metadata.cast.map((name, index) => ({
      name: name,
      talent_type: "Actor"
    }));
  }

  if (metadata.director) {
    talent.director = metadata.director.map((name, index) => ({
      name: name,
      talent_type: "Director"
    }));
  }

  if (metadata.producers) {
    talent.producer = metadata.producers.map((name, index) => ({
      name: name,
      talent_type: "Producer"
    }));
  }

  if (metadata.screenwriters) {
    talent.screenplay = metadata.screenwriters.map((name, index) => ({
      name: name,
      talent_type: "Screenwriter"
    }));
  }

  const res = {
    "public": {
      "asset_metadata": {
        "display_title": metadata.displayTitle || "",
        "movie_clips_id": metadata.id || "",
        "info": {
          "copy_right": metadata.copyRight,
          "run_time": metadata.duration || "",
          "synopsis": metadata.clipDescription || "",
          "talent": talent,
          "release_year": metadata.year ? metadata.year.substring(0, 4) : ""
        },
        "title": metadata.title || "",
        "query": metadata.query || "",
        "film_description": metadata.filmDescription || ""
      },
      "name": metadata.title || ""
    }
  }

  return res;
}
