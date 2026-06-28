const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  type:        { type: String, required: true },
  severity:    { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
  commitHash:  { type: String, required: true },
  commitDate:  { type: Date },
  authorName:  { type: String },
  preview:     { type: String },   // first 6 chars + REDACTED
  lineContext: { type: String },   // surrounding code with secret replaced
  hint:        { type: String },   // remediation advice
});

const scanResultSchema = new mongoose.Schema(
  {
    repoPath:            { type: String, required: true },
    repoName:            { type: String }, // derived from path
    status:              { type: String, enum: ['running', 'done', 'error'], default: 'running' },
    totalCommitsScanned: { type: Number, default: 0 },
    findings:            [findingSchema],
    errorMessage:        { type: String },
  },
  { timestamps: true }
);

// Virtual: count by severity
scanResultSchema.virtual('summary').get(function () {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  this.findings.forEach((f) => counts[f.severity]++);
  return counts;
});

scanResultSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('ScanResult', scanResultSchema);
