const fs = require('fs-extra')
const yaml = require('js-yaml')
const { join, extname } = require('path')
const isUrl = require('is-url-superb')
const { http, https } = require('follow-redirects');
const Ajv = require('ajv');
const { generate_feed } = require('./generate-feed')

let config = require("./config.json")

let HostPrefix
if(config.HostPrefix){
    HostPrefix = config.HostPrefix
} else {
    HostPrefix = process.env["HOST_PREFIX"]
}
if(!HostPrefix){
    throw new Error("HOST_PREFIX is not defined")
}

const PUBLIC = join(__dirname, '/db/public')

const APP_TYPES = ['weblink', 'hosted', 'packaged', 'privileged', 'certified', 'root']
const ALLOWED_IMAGE_EXTENTIONS = ['.png','.jpeg', '.jpg', '.gif', '.svg']

const DEBUG = process.env.ENV === "DEVELOPMENT"
const ICONS_FOLDER = join(PUBLIC, 'icons')

const isEmpty = (string) => typeof string !== "string" || string.trim().length == 0
const urlExtname = (url) => extname(url).split(/\?|\#/)[0]
const hasValidImageExtention = (url) => ALLOWED_IMAGE_EXTENTIONS.includes(urlExtname(url))

/** Checks if everything is valid and if the data is complete */
function validate_apps(appData, availibleCategories) {
    const errors = []
    const error = error => errors.push("- " + error)

    if (isEmpty(appData.name)) {
        error("Name is missing")
    }

    if (isEmpty(appData.description)) {
        error("Description is missing")
    }

    if (isEmpty(appData.icon)) {
        error("Icon is missing")
    } else if (!isUrl(appData.icon) || !hasValidImageExtention(appData.icon)) {
        error("Icon url invalid")
    }

    if (appData.download) {
        if (isEmpty(appData.download.url)) {
            error("download.url missing")
        } else if (!isUrl(appData.download.url)) {
            error("download.url invalid")
        }
        if (isEmpty(appData.download.version)) {
            error("download.version missing")
        }
    } else {
        error("Download field missing")
    }

    if (Array.isArray(appData.author)) {
        //check that all elements of the array are strings
        if(!appData.author.every(i => (i && typeof i === "string"))) {
            error("Author/s invalid: not all elements are strings")
        }
    } else if (isEmpty(appData.author)) {
        error("Author is missing")
    }

    if (Array.isArray(appData.maintainer)) {
        //check that all elements of the array are strings
        if(!appData.maintainer.every(i => (i && typeof i === "string"))) {
            error("Maintainer/s invalid: not all elements are strings")
        }
    } else if (isEmpty(appData.maintainer)) {
        error("Maintainer is missing")
    }

    if (Array.isArray(appData.locales)) {
        //check that all elements of the array are strings
        if(!appData.locales.every(i => (i && typeof i === "string"))) {
            error("Locales/s invalid: not all elements are strings")
        }
    } else if (isEmpty(appData.locales)) {
        error("Locales is missing")
    }
  
    if (appData.meta) {
        if (isEmpty(appData.meta.tags)) {
            error("meta.tags missing")
        }

        if (Array.isArray(appData.meta.categories)) {
            // todo check if they were defined
            appData.meta.categories.forEach(category => {
                if (availibleCategories.indexOf(category) === -1) {
                    error(`meta.categories: "${category}" was not found, did you forget define it in the 'categories' folder?`)
                }
            })
        } else {
            error("meta.categories missing or not an array")
        }
    } else {
        error("meta is missing")
    }

    if (isEmpty(appData.type)) {
        error("type missing")
    } else if (!APP_TYPES.includes(appData.type)) {
        error(appData.type + "is not a valid app type, this field can contain one of " + APP_TYPES.join(', '))
    }

    if (isEmpty(appData.license)) {
        error("License is missing")
    }

    if (typeof appData.has_tracking !== "boolean") {
        error("has Tracking is missing")
    }

    if (typeof appData.has_ads !== "boolean") {
        error("has Ads is missing")
    }

    if (typeof appData.fromstore !== "boolean") {
        error("Unrecognized source")
    }

    // Optional

    if (Array.isArray(appData.screenshots)) {
        appData.screenshots.forEach(screenshot_url => {
            if (!isUrl(screenshot_url) || !hasValidImageExtention(appData.icon)) {
                error(`Screenshot url invalid: "${screenshot_url}"`)
            }
        });
    }

    if (appData.dependencies) {
        if (Array.isArray(appData.dependencies)) {
            appData.dependencies.forEach(() => {
                if(!appData.dependencies.every(i => (i && typeof i === "object"))) {
                    error("Dependencies invalid: not all elements are objects")
                }
                for (let i = 0; i < appData.dependencies.length; i++) {
                    if (!appData.dependencies[i].url) {
                        appData.dependencies[i].url = ""
                    }
                }
                
            });
        }
    } else {
        appData.dependencies = []
    }
    

    if (appData.website) {
        if (!isUrl(appData.website)) {
            error(`Website url invalid: "${appData.website}"`)
        }
    }

    if (appData.git_repo) {
        if (!isUrl(appData.git_repo)) {
            error(`Git repo url invalid: "${appData.git_repo}"`)
        }
    }

    if (appData.donation) {
        if (!isUrl(appData.donation)) {
            error(`donation url invalid: "${appData.donation}"`)
        }
    }


    if (errors.length > 0) {
        throw new Error(errors.join('\n '))
    }
}

function validate_category(category) {
    const errors = []
    const error = error => errors.push("- " + error)

    if (isEmpty(category.name)) {
        error("Name is missing")
    }

    // description is optional
    // if (isEmpty(category.description)) {
    //     error("Description is missing")
    // }

    if (isEmpty(category.icon)) {
        error("Icon is missing")
    } else if (false /** todo check if it is an valid font awesome icon */ ) {
        error("Icon code is not a valid font awesome icon")
    }

    if (category.locales) {
        if (Array.isArray(category.locales)) {
            category.locales.forEach(() => {
                if(!category.locales.every(i => (i && typeof i === "object"))) {
                    error("Locale/s invalid: not all elements are objects(category)")
                }
            });
        }
    } else {
        category.locales = []
        // error("Locales is missing (category)")
    }
    // if (category.locales) {
    //     if (Array.isArray(category.locales)) {
    //         category.locales.forEach(() => {
    //             if(!category.locales.every(i => (i && typeof i === "object"))) {
    //                 error("Locale/s invalid: not all elements are objects(category)")
    //             }
    //         });
    //     }
    // } else {
    //     category.locales = []
    // }

    if (errors.length > 0) {
        throw new Error(errors.join('\n '))
    }
}

function downloadFile(url, dest) {
  // inspired by https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries/22907134#22907134
  return new Promise((resolve,reject) => {
      const file = fs.createWriteStream(dest);
      if (url.indexOf('http') !== 0) {
          reject("url does not have the http or https scheme")
      }
      const get = url.indexOf('https') === 0 ? https.get:http.get;
      get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
          file.close(resolve);  // close() is async, call cb after close completes.
        });
      }).on('error', function(err) { // Handle errors
        fs.unlink(dest);
        reject(err.message);
      });
  })
};

async function download_icon(appSlug, url){
    await downloadFile(url, join(ICONS_FOLDER, appSlug + urlExtname(url) ))
}

function path_to_downloaded_icon(appSlug, url) {
    return 'https://' + join(HostPrefix, 'icons/', appSlug + urlExtname(url));
}

async function download_screenshots(appSlug, urls){
    await fs.ensureDir(join(ICONS_FOLDER, appSlug))
    await Promise.all(
        urls.map(
            (url, index) => downloadFile(url, join(ICONS_FOLDER, appSlug, 'screenshot' + index + urlExtname(url)))
        )
    )
}

function paths_to_downloaded_screenshots(appSlug, urls) {
    return urls.map(
        (url, index) => 'https://' + join(HostPrefix, 'icons/', appSlug, 'screenshot' + index + urlExtname(url))
    )
}

async function main() {
    let success = true

    await fs.ensureDir(PUBLIC)
    await fs.emptyDir(PUBLIC)
    await fs.ensureDir(ICONS_FOLDER)

    console.log("Processing categories:")
    const CATEGORIES = join(__dirname, '/db/categories')
    const cfiles = await fs.readdir(CATEGORIES)

    let categories = {}

    for (let i = 0; i < cfiles.length; i++) {
        const file = cfiles[i]
        console.log("... Processing", file, '...')
        try {
            const yaml_content = await fs.readFile(join(CATEGORIES, file), 'utf-8')
            const data = yaml.load(yaml_content)
            validate_category(data)
            categories[file.replace(/.ya?ml/, "")] = data
        } catch (error) {
            console.error(`Error/s in ${file}:\n`, error.message)
            success = false
        }
    }

    // log all found categories
    console.log("Found the following Categories:", Object.keys(categories), "\n")

    console.log("Processing apps:")

    const APPS = join(__dirname, '/db/apps')
    const afiles = await fs.readdir(APPS)

    let apps = []
    let download_queu = []

    for (let i = 0; i < afiles.length; i++) {
        const file = afiles[i]
        console.log("... Processing", file, '...')
        try {
            const yaml_content = await fs.readFile(join(APPS, file), 'utf-8')
            const appData = yaml.load(yaml_content)
            validate_apps(appData, Object.keys(categories))
            
            appData.slug = file.replace(/.ya?ml/, "")
            // download icon
            download_queu.push(
                download_icon(appData.slug, appData.icon)
            )
            appData.icon = path_to_downloaded_icon(appData.slug, appData.icon)
            // download screenshots
            download_queu.push(
                download_screenshots(appData.slug, appData.screenshots || [])
            )
            appData.screenshots = paths_to_downloaded_screenshots(appData.slug, appData.screenshots || [])

            //convert dependencies to array
            if(!Array.isArray(appData.dependencies)){
                appData.dependencies = [appData.dependencies]
            }
            //convert locales to array
            if(!Array.isArray(appData.locales)){
                appData.locales = [appData.locales]
            }
            //convert maintainer to array
            if(!Array.isArray(appData.maintainer)){
                appData.maintainer = [appData.maintainer]
            }
            //convert author to array
            if(!Array.isArray(appData.author)){
                appData.author = [appData.author]
            }
            
            // add app to dataset

            apps.push(appData)
        } catch (error) {
            console.error(`Error/s in ${file}:\n`, error.message)
            success = false
        }
    }

    const generated_at =  Date.now();

    await fs.writeJSON(join(PUBLIC, 'data.json'), {
        $schema: "./schema.json",
        version: 2,
        generated_at,
        categories,
        apps
    }, { spaces: DEBUG ? 1 : 0 })

    if(success){
        // Validate that data.json is compliant with schema.json
        console.log("Validate that data.json")
        let ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}
        let validate = ajv.compile(await fs.readJSON(join(__dirname, 'schema.json')));
        let valid = validate(await fs.readJSON(join(PUBLIC, 'data.json'), 'utf-8'));
        if (!valid) {
            console.log("validation error:", validate.errors)
            success = false
        };
        console.log("Validation of data.json done")
    }

    await fs.writeFile(join(PUBLIC, 'lastUpdate.txt'), String(generated_at))

    await fs.copyFile(join(__dirname, 'schema.json'), join(PUBLIC, 'schema.json'))

    await fs.copyFile(join(__dirname, 'index.html'), join(PUBLIC, 'index.html'))

    console.log("writing feed")
    await fs.writeFile(join(PUBLIC, 'feed.xml'), await generate_feed(apps, categories))
    
    console.log("waiting for downloads to complete...")
    await Promise.all(download_queu);
    console.log("done")


    if (!success) {
        process.exit(1)
    }
}

main()
