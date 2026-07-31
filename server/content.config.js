// What AIVA actually sends over WhatsApp when a client asks for a brochure, location, or link.
// Fill these in via your .env.local (see .env.example) — nothing sensitive is hardcoded here.

export function getContent() {
  return {
    brochure: {
      url: process.env.WHATSAPP_BROCHURE_URL || '',
      filename: process.env.WHATSAPP_BROCHURE_FILENAME || 'AIVA_Property_Brochure.pdf',
      caption: process.env.WHATSAPP_BROCHURE_CAPTION || 'Here is the property brochure you asked for!',
    },
    location: {
      name: process.env.WHATSAPP_LOCATION_NAME || '',
      address: process.env.WHATSAPP_LOCATION_ADDRESS || '',
      latitude: parseFloat(process.env.WHATSAPP_LOCATION_LAT || '0'),
      longitude: parseFloat(process.env.WHATSAPP_LOCATION_LNG || '0'),
    },
    link: {
      url: process.env.WHATSAPP_WEBSITE_URL || '',
      message: process.env.WHATSAPP_LINK_MESSAGE || 'Here is the link you asked for:',
    },
  };
}
