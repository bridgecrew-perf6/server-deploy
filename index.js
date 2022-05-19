const admin = require('firebase-admin')
const serviceAccount = require('./ServiceAccountKey.json')
const nodemailer = require("nodemailer");
const { scheduleJob } = require('node-schedule')
const io = require('socket.io')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

const listings = db.collection('listings')


function processDocument(document){
        let object = document.data()
            object = Object.assign(object, {id: document.id}, {endDate: document.data().endTime.toDate()})
        return object
    }

// Nodemailer
let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    auth: {
      user: 'dontreplybonkers@gmail.com', // generated ethereal user
      pass: 'Bonkbonk135', // generated ethereal password
    },
});

function sendMail(sellerMail, buyerMail, title, price) {

    let text = "Varen din fikk ingen bud dessverre."
    if (buyerMail) {
        text = "Brukeren " + buyerMail + " hadde det høyestebudet på varen din: kr " + price + ". Ta kontakt med kjøper for å fullføre kjøpet!"
        // Til kjøperen
        transporter.sendMail({
            from: '"Bonkers" <dontreplybonkers@gmail.com>',
            to: 'eythorlogi96@gmail.com, larsmaarvik@gmail.com',
            subject: "Du har vunnet auksjonen " + title + "!",
            text: "Du hadde det høyeste budet på varen " + title + ": kr " + price + ". Ta kontakt på email " + sellerMail + " for å fullføre kjøpet!"
        }).then(info => {
            console.log({info});
        }).catch(console.error);
    }
    // Til selger
    transporter.sendMail({
        from: '"Bonkers" <dontreplybonkers@gmail.com>',
        to: 'eythorlogi96@gmail.com, larsmaarvik@gmail.com',
        subject: "Auksjonen din " + title + " er sluttet!",
        text: text
    }).then(info => {
        console.log({info});
    }).catch(console.error);
}

// Auksjonsslutt
async function endAuction(id){
    const doc = await listings.doc(id).get()
    const docData = doc.data()
    console.log('Annonse ' + id + ' ble avsluttet!');
    sendMail(docData.owner, docData.highestBidder, docData.title, docData.bid)
    await listings.doc(id).update({
        active: false
    })
}

function scheduleAuctionEnd(doc){
    const date = doc.data().endTime.toDate()
    scheduleJob(date, function() {
        console.log(doc);
        endAuction(doc.id);
    })
}

// Socket
io.on('connection', async (socket) =>
{
    const listingsArray = []

    await listings.where('active', '==', true).get().then( res =>
    {   
        res.forEach(document =>
        {   
            listingsArray.push(processDocument(document))
        })
    }).then( () => 
    {
        socket.emit('db-listings', listingsArray)
    })

    socket.on('listing-registered', async (id)=>{
        const doc = await listings.doc(id).get()
        scheduleAuctionEnd(doc)
        io.emit('new-listing', processDocument(doc))
    })

    socket.on('new-bid', (object) => {
        socket.broadcast.emit('new-bid', object)
    })

})











