// services/sessionManager.js
const Session = require('../models/session');
const Report = require('../models/report.model');
const { reportQueue } = require('./reportWorker');

async function finalizeSessionAndStartReport(sessionId, endReason = 'natural_conclusion') {
    try {
        const session = await Session.findById(sessionId);
        if (!session || session.status === 'completed') {
            return;
        }

        session.status = 'completed';
        session.endReason = endReason;
        await session.save();
        console.log(`[Manager] Session ${sessionId} marked as 'completed'.`);

        const existingReport = await Report.findOne({ session: sessionId });
        if (existingReport) {
            return;
        }

        const newReport = new Report({
            session: sessionId,
            status: 'pending',
            role: session.role,
            company: session.company
        });
        await newReport.save();
        
        await reportQueue.add('generate-report', {
            reportId: newReport._id,
            sessionId: sessionId
        });
        console.log(`[Manager] Job for report ${newReport._id} added to queue.`);

    } catch (error) {
        console.error(`[Manager] Failed to finalize session for ${sessionId}:`, error);
    }
}

module.exports = { finalizeSessionAndStartReport };

// You would then call this function from your socket disconnect handler
// or wherever a session officially ends.
//
// Example Usage (e.g., in your main server file):
//
// io.on('connection', (socket) => {
//   socket.on('disconnect', async () => {
//     const sessionId = socket.handshake.query.sessionId;
//     if (sessionId) {
//       await finalizeSessionAndStartReport(sessionId, 'user_ended');
//     }
//   });
// });