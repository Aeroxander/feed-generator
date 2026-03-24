require('dotenv').config()
console.log('Value:', process.env.SKIP_TOKEN_HOLDER_CHECK)
console.log('Includes quotes?', process.env.SKIP_TOKEN_HOLDER_CHECK.includes('"'))
console.log('Equals true?', process.env.SKIP_TOKEN_HOLDER_CHECK === 'true')
