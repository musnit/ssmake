#!/usr/bin/env node
"use strict";

const mv = require('mv');
const fs = require('fs');
const rimraf = require('rimraf');
const gm = require('gm').subClass({imageMagick: true});

var mkdirp = require('mkdirp');

function run_cmd(cmd, args, callBack ) {
    var spawn = require('child_process').spawn;
    var child = spawn(cmd, args);
    var resp = "";

    child.stdout.on('data', function (buffer) { resp += buffer.toString() });
    child.stdout.on('end', function() { callBack (resp) });
    child.stdout.on('error', function() { console.log('error') });
} // ()

function pad(num, size) {
  var s = num+"";
  while (s.length < size) s = "0" + s;
  return s;
}

const gifFile = process.argv[2];
const horizontalPieces = process.argv[3] || 7;
const verticalPieces = process.argv[4] || 5;
const numPieces = horizontalPieces * verticalPieces;

console.log("Removing old tmp directory");
rimraf('tmp', () => {
  console.log("Done. Making new tmp directory");
  mkdirp('tmp/all-frames', (err) => {
    console.log('Done. Splitting gif into frames');
    run_cmd('convert', ['-coalesce', gifFile, 'tmp/all-frames/%04d.jpg'], (resp) => {
      console.log('Split done. Cutting all frames');
      const files = fs.readdirSync('tmp/all-frames').map((filename) => filename.slice(0, -4));
      let numFrames = files.length;
      let frameCount = 0;
      files.forEach((filename) => {
        const frameDir = 'tmp/cut-by-frame/' + filename + '/';
        mkdirp(frameDir, (err) => {
          run_cmd('convert', [`tmp/all-frames/${filename}.jpg`, '-crop', `${horizontalPieces}x${verticalPieces}@`, '+repage',
            '+adjoin', `${frameDir}${filename}_%04d.jpg`], (resp) => {
              frameCount++;
              console.log(frameCount + ' of ' + numFrames + ' frames cut');
              if (frameCount === numFrames){
                console.log('All frames cut, reorganizing into folders by cut piece');
                let pieceCount = 0;
                for (let i = 0; i < numPieces; i++){
                  mkdirp(`tmp/cut-by-piece/${pad(i, 4)}`, (err) => {
                    pieceCount++;
                    console.log(pieceCount + ' of ' + numPieces + ' cut folders created');
                    if (pieceCount === numPieces){
                      console.log('All cut folders created, moving pieces');
                      const frameFolders = fs.readdirSync('tmp/cut-by-frame');
                      let totalNumPieces = numPieces * numFrames;
                      let pieceOrganizeCount = 0;
                      frameFolders.forEach((frameNumber) => {
                        const framePieces = fs.readdirSync(`tmp/cut-by-frame/${frameNumber}`);
                        framePieces.forEach((pieceNumberFile) => {
                          const pieceNumber = pieceNumberFile.split('_')[1].split('.')[0];
                          mv(`tmp/cut-by-frame/${frameNumber}/${pieceNumberFile}`,
                            `tmp/cut-by-piece/${pieceNumber}/${pieceNumberFile}`,
                            { mkdirp: true }, function(err) {
                              pieceOrganizeCount++;
                              console.log(pieceOrganizeCount + ' of ' + totalNumPieces + ' pieces organized');
                              if (pieceOrganizeCount === totalNumPieces){
                                console.log('All pieces organized');
                                console.log('Creating piece spritesheets');
                                mkdirp(`tmp/sprites/`, (err) => {
                                  const pieceFolders = fs.readdirSync('tmp/cut-by-piece');
                                  let spriteCount = 0;
                                  pieceFolders.forEach((pieceFolder) => {
                                    run_cmd('convert', [`tmp/cut-by-piece/${pieceFolder}/*.jpg`, '+append', `tmp/sprites/sprite_${pieceFolder}.jpg`], (resp) => {
                                      spriteCount++;
                                      console.log(spriteCount + ' of ' + numPieces + ' sprites created');
                                      if (spriteCount === numPieces){
                                        console.log('All sprites created! Creating manifest!');
                                        const spriteFiles = fs.readdirSync('tmp/sprites');
                                        let spritesManifested = 0;
                                        let spritesManifest = {
                                          sprites: {},
                                          horizontalPieces: horizontalPieces,
                                          verticalPieces: verticalPieces,
                                          numFrames: numFrames
                                        };
                                        spriteFiles.forEach((spriteFile) => {
                                          gm(`tmp/sprites/${spriteFile}`)
                                          .size(function (err, size) {
                                            spritesManifested++;
                                            spritesManifest.sprites[`${spriteFile}`] = [size.width/numFrames, size.height];
                                            if (spritesManifested === numPieces) {
                                              fs.writeFile("tmp/manifest.json", JSON.stringify(spritesManifest), function(err) {
                                                  if(err) {
                                                    return console.log(err);
                                                  }
                                                  console.log("All done!");
                                              });
                                            }
                                          });
                                        });
                                      }
                                    });
                                  });
                                });
                              }
                          });
                        });
                      });
                    }
                  });
                }
              }
          });
        });
      });
    });
  });
});
/*mv('source/dir', 'dest/a/b/c/dir', {mkdirp: true}, function(err) {
  // done. it first created all the necessary directories, and then
  // tried fs.rename, then falls back to using ncp to copy the dir
  // to dest and then rimraf to remove the source dir
});
*/
