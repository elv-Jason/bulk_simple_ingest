# bulk_simple_ingest

A utilities package that can be added to [elv-utils-js/utilities](https://github.com/eluv-io/elv-utils-js/) to allow bulk ingestion of MP4 videos.

This package specifically targets the ingestion of the [moveCLIP dataset](https://sail.usc.edu/~mica/MovieCLIP//).

## Directory Layout

     .
     ├── bulk_ingest.py
     ├── MetaCreate.js
     ├── TitleExtract.js
     ├── SimpleIngest.js
     ├── data
     │   ├── config.json
         ├── content_data.json
         ├── mp4_names.json

## Installation

```
git clone https://github.com/eluv-io/elv-utils-js
cd elv-utils-js
npm install

cd utilities
git clone git@github.com:elv-Jason/bulk_simple_ingest.git

export FABRIC_CONFIG_URL = "Configuration url"
export PRIVATE_KEY = Private key

cd bulk_simple_ingest
```

## Configuration Setup (/config/config.json)

```
{
  "videoPath": ,
  "outputJsonPath": "./data/content_data.json",
  "abrProfilePath": YOUR ABR PROFILE PATH
}
```

## Command

python bulk_ingest.py

## Usage

#### bulk_ingest.py
* Iterates through the MP4 files within the directory and executes the ingestion process. It stores the ingested video's display title in data/mp4_names.json to avoid redundant ingestion.

#### TitleExtract.js
* Extracts the original title (e.g., Harry Potter and the Deathly Hallows: Part 2 (1/5) Movie CLIP - Ron and Hermione Kiss (2011) HD).


#### MetaCreate.js

* Extracts all the essential metadata of the video by calling ffmpeg -i / ffprobe and stores the information in data/content_data.json.


#### SimpleIngest.js

* Extracts the original title of the content by calling TitleExtract.js.
* Extracts and saves the essential metadata by calling MetaCreate.js.
* Creates a master object and grants access to the permission group.
* Creates a mezzanine object and grants access to the permission group. -> This can be modified based on the user's need

## Sample Ingested Mezzanine

<img width="1065" alt="Screenshot 2024-07-08 at 1 11 01 PM" src="https://github.com/elv-Jason/movieCLIP_bulk_ingest_utilities/assets/171614703/09b0f709-6de0-4527-9468-633399018082">

