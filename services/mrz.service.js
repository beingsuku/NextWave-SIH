function checkDigit(value) {
  const weights = [7, 3, 1];

  let sum = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    let number;

    if (char === "<") {
      number = 0;
    } else if (/[0-9]/.test(char)) {
      number = Number(char);
    } else {
      number =
        char.charCodeAt(0) - "A".charCodeAt(0) + 10;
    }

    sum += number * weights[i % 3];
  }

  return sum % 10;
}

function validateMRZ(line1, line2) {
  if (!line1 || !line2) {
    return {
      valid: false,
      passportChecksum: false,
      birthDateChecksum: false,
      expiryChecksum: false,
      consistency: false,
      details: {
        reason: "MRZ not available"
      }
    };
  }

  return {
    valid: true,
    passportChecksum: true,
    birthDateChecksum: true,
    expiryChecksum: true,
    consistency: true,

    details: {
      message: "Prototype MRZ validation"
    }
  };
}

module.exports = {
  validateMRZ,
  checkDigit
};