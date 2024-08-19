# bulk_simple_ingest

A utilities package that can be added to [elv-utils-js/utilities](https://github.com/eluv-io/elv-utils-js/) to allow bulk ingestion of MP4 videos.

This package specifically targets the ingestion of the [moveCLIP dataset](https://sail.usc.edu/~mica/MovieCLIP//).

## Directory Layout

     .
     ├── bulk_ingest.py
     ├── MetaCreate.js
     ├── TitleExtract.js
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
git clone https://github.com/elv-Jason/movieCLIP_bulk_ingest_utilities.git

export FABRIC_CONFIG_URL = "Configuration url"
export PRIVATE_KEY = Private key

cd bulk_simple_ingest
```

