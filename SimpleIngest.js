// Create new production master from specified file(s)
const R = require("ramda");
const fs = require("fs");

const {ModOpt, NewOpt} = require("../lib/options");
const Utility = require("../lib/Utility");

const ABR = require("@eluvio/elv-abr-profile");

const Client = require("../lib/concerns/Client");
const Finalize = require("../lib/concerns/Finalize");
const LocalFile = require("../lib/concerns/LocalFile");
const LRO = require("../lib/concerns/LRO");
const ArgLibraryId = require("../lib/concerns/ArgLibraryId");
const config = JSON.parse(fs.readFileSync('./data/config.json', 'utf8'));
const { exec } = require('child_process');
const { getTitleFromVideo } = require('./TitleExtract.js');
const {seconds} = require("../lib/helpers");

class SimpleIngest extends Utility {
  blueprint() {
    return {
      concerns: [Client, Finalize, LocalFile, ArgLibraryId, LRO],
      options: [
        ModOpt("libraryId", {demand: true, forX: "new media object"}),
        NewOpt("title", {
          demand: true,
          descTemplate: "Title for new media object",
          type: "string"
        }),
        NewOpt("drm", {
          default: false,
          descTemplate: "Use DRM for playback",
          type: "boolean"
        }),
        ModOpt("files", {forX: "for new media object"})
      ]
    };
  }

  async body() {
    const logger = this.logger;

    const { files } = this.args;
    if (!files || files.length === 0) {
      throw new Error("No files specified for ingestion");
    }

    const filePath = files[0];
    config.videoPath = filePath;
    fs.writeFileSync('./data/config.json', JSON.stringify(config, null, 2), 'utf8');

    let fileHandles = [];
    const fileInfo = this.concerns.LocalFile.fileInfo(fileHandles);

    const client = await this.concerns.Client.get();

    const libInfo = await this.concerns.ArgLibraryId.libInfo();

    const libraryId = "ilib4JvLVStm2pDMa89332h8tNqUCZvY";
    const type = "musicgreen - Title Master";
    const title = await getTitleFromVideo(filePath).catch(() => path.basename(filePath, path.extname(filePath)));
    const encrypt = true;

    const runCommand = async (command) => {
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            return reject(error);
          }
          if (stderr) {
            console.error(`stderr: ${stderr}`);
          }
          resolve(stdout);
        });
      });
    };
    
    fs.writeFileSync(config.outputJsonPath, JSON.stringify({}), 'utf8');
    await runCommand(`node MetaCreate.js`);
    const rawData = fs.readFileSync(config.outputJsonPath, 'utf8');
    const metadataString = JSON.parse(rawData);


    function checkValues(obj) {
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
    
          if (typeof value === 'object' && value !== null) {
            checkValues(value);
          } else {
            if (value === null || value === undefined || value === '') {
              throw new Error(`Empty value found for key: ${key}`);
            }
          }
        }
      }
    }
    
    try {
      checkValues(metadataString);
      console.log('All entries have values.');
    } catch (error) {
      console.error(error.message);
    }

    const createMasterResponse = await client.CreateProductionMaster({
      libraryId,
      type,
      name: title,
      description: `Media object created via simple ingest: ${title}`,
      fileInfo,
      encrypt,
      copy: true,
      callback: this.concerns.LocalFile.callback,
      metadata: metadataString
    });

    const {id, hash} = createMasterResponse;
    logger.data("object_id", id);

    this.concerns.LocalFile.closeFileHandles(fileHandles);

    logger.errorsAndWarnings(createMasterResponse);

    logger.logList(
      "",
      "Production master default variant created:",
      `  Object ID: ${id}`,
      `  Version Hash: ${hash}`,
      ""
    );

    logger.data("version_hash", hash);

    if(!R.isNil(createMasterResponse.errors) && !R.isEmpty(createMasterResponse.errors)) throw Error(`Error(s) encountered while inspecting uploaded files: ${createMasterResponse.errors.join("\n")}`);

    await this.concerns.Finalize.waitForPublish({
      latestHash: hash,
      libraryId,
      objectId: id
    });


    const masterMetadata = (await client.ContentObjectMetadata({
      libraryId,
      objectId: id,
      versionHash: hash,
      metadataSubtree: "/production_master"
    }));

    const sources = R.prop("sources", masterMetadata);
    const variant = R.path(["variants", "default"], masterMetadata);

    if(this.args.json) {
      logger.data("media_files", sources);
      logger.data("variant_default", variant);
    }
    
    const abrProfilePath = config.abrProfilePath;
    const abrProfileContent = fs.readFileSync(abrProfilePath, "utf-8");
    const abrProfile = JSON.parse(abrProfileContent);
  
    logger.log("Setting up media file conversion...");
    const createMezResponse = await client.CreateABRMezzanine({
      name: title,
      libraryId,
      objectId: id,
      type,
      masterVersionHash: hash,
      variant: "default",
      offeringKey: "default",
      abrProfile
    });

    logger.errorsAndWarnings(createMezResponse);
    const createMezErrors = createMezResponse.errors;
    if(!R.isNil(createMezErrors) && !R.isEmpty(createMezErrors)) throw Error(`Error(s) encountered while setting up media file conversion: ${createMezErrors.join("\n")}`);

    await this.concerns.Finalize.waitForPublish({
      latestHash: createMezResponse.hash,
      libraryId,
      objectId: id
    });


    logger.log("Starting conversion to streaming format...");

    const startJobsResponse = await client.StartABRMezzanineJobs({
      libraryId,
      objectId: id,
      offeringKey: "default"
    });

    logger.errorsAndWarnings(startJobsResponse);
    const startJobsErrors = createMezResponse.errors;
    if(!R.isNil(startJobsErrors) && !R.isEmpty(startJobsErrors)) throw Error(`Error(s) encountered while starting file conversion: ${startJobsErrors.join("\n")}`);

    const lroWriteToken = R.path(["lro_draft", "write_token"], startJobsResponse);
    const lroNode = R.path(["lro_draft", "node"], startJobsResponse);

    logger.data("library_id", libraryId);
    logger.data("object_id", id);
    logger.data("offering_key", "default");
    logger.data("write_token", lroWriteToken);
    logger.data("write_node", lroNode);

    logger.logList(
      "",
      `Library ID: ${libraryId}`,
      `Object ID: ${id}`,
      "Offering: default",
      `Write Token: ${lroWriteToken}`,
      `Write Node: ${lroNode}`,
      ""
    );

    await this.concerns.Finalize.waitForPublish({
      latestHash: startJobsResponse.hash,
      libraryId,
      objectId: id
    });

    logger.log("Progress:");

    const lro = this.concerns.LRO;
    let done = false;
    let lastStatus;
    while(!done) {
      const statusMap = await lro.status({libraryId, objectId: id}); 
      const statusSummary = lro.statusSummary(statusMap);
      lastStatus = statusSummary.run_state;
      if(lastStatus !== LRO.STATE_RUNNING) done = true;
      logger.log(`run_state: ${lastStatus}`);
      const eta = statusSummary.estimated_time_left_h_m_s;
      if(eta) logger.log(`estimated time left: ${eta}`);
      await seconds(15);
    }

    const finalizeAbrResponse = await client.FinalizeABRMezzanine({
      libraryId,
      objectId: id,
      offeringKey: "default"
    });
    const latestHash = finalizeAbrResponse.hash;

    logger.errorsAndWarnings(finalizeAbrResponse);
    const finalizeErrors = finalizeAbrResponse.errors;
    if(!R.isNil(finalizeErrors) && !R.isEmpty(finalizeErrors)) throw Error(`Error(s) encountered while finalizing object: ${finalizeErrors.join("\n")}`);

    let libMezManageGroups = ["0x7d85fdeff73baecc7554998e52d8ff4f8ee75e96"];
    if(libMezManageGroups && libMezManageGroups.length > 0){
      for(const groupAddress of libMezManageGroups){
        logger.log("Setting access permissions for managers");
        await client.AddContentObjectGroupPermission({
          objectId: id,
          groupAddress,
          permission: "manage"
        });

      }
    }
    const libMezPermission = "editable";
    if(libMezPermission) {
      if(!["owner", "editable", "viewable", "listable", "public"].includes(libMezPermission)) {
        logger.warn(`Bad value for mez_permission_level: '${libMezPermission}', skipping permission setting`);
      } else {
        logger.log(`Setting object permission to '${libMezPermission}'`);
        const prevHash = await client.LatestVersionHash({objectId: id});

        await client.SetPermission({
          objectId: id,
          permission: libMezPermission
        });

        const newHash = await client.LatestVersionHash({objectId: id});

        if(prevHash === newHash) {
          logger.log("Version hash unchanged: " + newHash );
        } else {
          logger.log("Previous version hash: " + prevHash );
          logger.log("New version hash: " + newHash );
        }
        logger.data("version_hash", newHash);
      }
    }

    logger.logList(
      "",
      "Playable media object created:",
      `  Object ID: ${id}`,
      `  Version Hash: ${latestHash}`,
      ""
    );
    logger.data("version_hash", latestHash);
    await this.concerns.Finalize.waitForPublish({
      latestHash,
      libraryId,
      objectId: id
    });
  }

  header() {
    return "Create playable media object via simple ingest";
  }
}

if(require.main === module) {
  Utility.cmdLineInvoke(SimpleIngest);
} else {
  module.exports = SimpleIngest;
}
