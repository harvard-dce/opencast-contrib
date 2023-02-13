#DCE notes for Opencast Paella Player
## Repositories


+ Opencast Paella: As of Sept 2019 github.com:harvard-dce/dce-paella-opencast is no longer separate. The code now exists in this module.
+ The HUDCE extension plugins are at github.com:harvard-dce/dce-paella-extensions
+ [Paella 6x repository](https://github.com/polimediaupv/paella)

## Customized Resources
The gulpfile has been customized to add DCE overrides to the vanilla Opencast files in this module.
The package.json identifies the source repositories and versions of UPV Paella, DCE custom plugins, and DCE overrides for Paella and Openast-Paella files.

- All Opencast player-paella module javascript/css/html overrides are in this repository
- All UPV Paella player javascript/css/html overrides are at [dce-paella-opencast paella_overrides](https://github.com/harvard-dce/dce-paella-opencast/tree/master/vendor/paella_overrides).

## Building the Jar for module deploy

To build with the pre-constructed dependencies: run `mvn clean install`
To build with updated developement dependencies: run `mvn clean install -DdevBuild`

## Development

### If developing with a different dce-paella-extensions repo branch...
+ run `rm package-lock.json`
+ run `rm -rf node_modules`
+ run `rm -rf target`
+ run `vi package.json` and modify the dce-paella-extensions dependency:

> + Using a dce-paella-extensions branch:
> "dce-paella-extensions": "harvard-dce/dce-paella-extensions#t/OPC-XYZ-newPlugin-ABC",
+ Using a dce-paella-extensions tag:  "dce-paella-extensions": "harvard-dce/dce-paella-extensions#v2.3.0",
+ Using a dce-paella-extensions npm published versions:   "dce-paella-extensions": "2.4.0",
then continue below...

### install the node dev depencencies
+ run `npm install`
+ run `mvn clean install -DdevBuild`

### Build the dependencies
run `node_modules/gulp/bin/gulp.js default`

### Running the server locally
run `node_modules/gulp/bin/gulp.js server`

### TODO: Running OC upstream devserver is not tested
run `node_modules/gulp/bin/gulp.js upstream-devserver`

### Developing on all dce-XYZ branches locally
In another directory, clone the dce-paella-extensions repository:
- github.com:harvard-dce/dce-paella-extensions

In dce-paella-extensions, run `npm link`
In this repository, run `npm link dce-paella-extensions`

When ready to build from the local branches, run `gulp build`
If `node_modules/gulp/bin/gulp.js server` has difficulty after linking the local dce-paella-opencast repo, it's test server config might need to moved to this repo.
 

