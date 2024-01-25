const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
// const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initiallizeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log(
        'Server Running at https://yogichaitanyapncjfnjscpikngv.drops.nxtwave.tech:3000/',
      )
    })
  } catch (e) {
    console.log(`DB ERROR: ${e.message}`)
    process.exit(1)
  }
}

initiallizeDBAndServer()

// API 1
// we have to get the jwtToken from this API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  let checkTheUsername = `SELECT * FROM user WHERE username='${username}';`
  let dbUser = await db.get(checkTheUsername)

  if (dbUser === undefined) {
    // invalid user
    response.status(400)
    response.send('Invalid user')
  } else {
    // check the user password
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      // how to create jwt token
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      // wrong password
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// Authentication with Token
// we have to verify weather user is exists or not?
const authentication = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

// API 2
app.get('/states/', authentication, async (request, response) => {
  const getAllStates = `SELECT * FROM state ORDER BY state_id;`
  const allStates = await db.all(getAllStates)

  const convertDBObjectToResponseObject = dbObject => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    }
  }

  response.send(
    allStates.map(eachState => convertDBObjectToResponseObject(eachState)),
  )
})

// API 3
app.get('/states/:stateId/', authentication, async (request, response) => {
  const {stateId} = request.params
  const getStateByStateId = `SELECT * FROM state WHERE state_id=${stateId};`
  const findState = await db.get(getStateByStateId)

  const convertDBObjectToResponseObject = dbObject => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    }
  }
  const result = convertDBObjectToResponseObject(findState)
  response.send(result)
})

// API 4
app.post('/districts/', authentication, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const createNewDistrictTable = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`
  await db.run(createNewDistrictTable)
  response.send('District Successfully Added')
})

// API 5
app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictIdDetails = `SELECT * FROM district WHERE district_id=${districtId};`
    const findDistrict = await db.get(getDistrictIdDetails)

    const convertDBObjectToResponseObject = dbObject => {
      return {
        districtId: dbObject.district_id,
        districtName: dbObject.district_name,
        stateId: dbObject.state_id,
        cases: dbObject.cases,
        active: dbObject.active,
        deaths: dbObject.deaths,
      }
    }

    const result = convertDBObjectToResponseObject(findDistrict)
    response.send(result)
  },
)

// API 6
app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const deleteTable = `DELETE FROM district WHERE district_id=${districtId};`
    await db.run(deleteTable)
    response.send('District Removed')
  },
)

// API 7
app.put(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const {districtDetails} = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const updateTheDistrictQuery = `
    UPDATE
      district
    SET
      district_name='${districtName}',
      state_id=${stateId},
      cases=${cases},
      cured=${cured},
      active=${active},
      deaths=${deaths}
    WHERE
      district_id=${districtId};`

    await db.run(updateTheDistrictQuery)
    response.send('District Details Updated')
  },
)

// API 8
app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params
    const getTotalCountOfSpecificState = `
          SELECT
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths 
          FROM district 
          WHERE state_id=${stateId};`
    const stateWisetotalCount = await db.get(getTotalCountOfSpecificState)
    response.send({
      totalCases: stateWisetotalCount['totalCases'],
      totalCured: stateWisetotalCount['totalCured'],
      totalActive: stateWisetotalCount['totalActive'],
      totalDeaths: stateWisetotalCount['totalDeaths'],
    })
  },
)

module.exports = app
