const express = require('express')
const socket = require('socket.io')
const http = require('http')
const morgan = require('morgan')
const helmet = require('helmet')
const mongoose = require('mongoose')
const cors = require('cors')
const path = require('path')
const { PythonShell } = require('python-shell')
const Room = require('./models/room')
const indexRoutes = require('./routes/index')
const controllers = require('./controllers/index')

// DotENV config
require('dotenv').config()

// Declaring the express app
const app = express()

// Connecting to Database
const dbUrl = process.env.DB_URL || ''
const dbName = process.env.DB_NAME || ''
mongoose
  .connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName,
  })
  .then(() => console.log('Connected to MongoDB...'))
  .catch(error => console.log('MongoDB Error:\n', error))
mongoose.set('useCreateIndex', true)

// Morgan for logging requests
app.use(morgan('tiny'))

// A little security using helmet
app.use(helmet())

// CORS
app.use(cors())

// Socket.io integration with express
const server = http.createServer(app)

// Creating the socket
const io = socket(server)

// JSON parser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Users count for each room
const rooms = {}

io.sockets.on('connection', function(socket) {
  console.log('Connection Established ', socket.id)
  socket.on('add_user', async function(data) {
    socket.username = data.username
    socket.room = data.website

    const roomExist = await Room.exists({ website: socket.room })

    if (roomExist) {
      socket.join(socket.room)
    } else {
      controllers.addRoom(socket.room)
      socket.join(socket.room)
    }

    if (!rooms[data.website]) {
      rooms[data.website] = 1
    } else {
      rooms[data.website]++
    }
    console.log('Number of users in', socket.room, ':', rooms[socket.room])
  })

  socket.on('send_M', data => {
    const options = {
      args: [data.message],
      scriptPath: './python',
    }
    PythonShell.run('run_model.py', options, function(err, result) {
      if (err) {
        console.log(err)
      } else {
        const temp = result[0].split(' ')
        if (Number(temp[0]) > 0.55 || Number(temp[1]) > 0.55) {
          io.sockets.in(socket.room).emit('delete_message', {
            message: data.message,
          })
          controllers.updateMsg(data.message)
        }
      }
    })

    controllers.addMsg(socket.username, data.message, socket.room)
    io.sockets.in(socket.room).emit('receive_M', {
      username: socket.username,
      message: data.message,
    })
  })

  socket.on('Disconnect', data => {
    console.log('User Disconnected')
    rooms[data.website]--
    console.log('Number of users in', socket.room, ':', rooms[socket.room])
  })
})

// Serving public folder
app.use('/', express.static(path.join(__dirname, '/public')))

// Specifying routes
app.use('/', indexRoutes)

const port = process.env.PORT || 4848

server.listen(port, () => {
  console.log(
    `Server is running in ${process.env.NODE_ENV} mode on port ${port}...`
  )
})
