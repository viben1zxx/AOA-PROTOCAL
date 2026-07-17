const fs = require('fs')
const path = require('path')

const templatePath = path.resolve(__dirname, '../.env.template')
const envPath = path.resolve(__dirname, '../.env')

if (!fs.existsSync(templatePath)) {
    console.error('.env.template not found. Please create or restore the template file.')
    process.exit(1)
}

if (fs.existsSync(envPath)) {
    console.log('.env already exists. No changes made.')
    process.exit(0)
}

const template = fs.readFileSync(templatePath, 'utf8')
fs.writeFileSync(envPath, template, 'utf8')
console.log('Created .env from .env.template. Paste your secrets into .env and restart the app.')
