
import React, { useState, useEffect } from 'react';

interface ContactProps {
  prefillData?: { projectName: string; plotNumber: string; } | null;
}

const Contact: React.FC<ContactProps> = ({ prefillData }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  
  useEffect(() => {
    if (prefillData) {
      setFormData(prev => ({
        ...prev,
        message: `Hello, I am interested in booking a site visit for plot number ${prefillData.plotNumber} in the '${prefillData.projectName}' project.`
      }));
    }
  }, [prefillData]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the data to a server
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };
  
  const whatsappNumber = "917000577087"; // Updated with actual number
  const whatsappMessage = "Hello Dhanshri Properties, I'm interested in one of your projects.";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-800">Get In Touch</h1>
        <p className="text-center text-gray-500 mt-1 mb-8">We are here to help you. Reach out to us for any queries.</p>
        
        <div className="bg-white p-8 rounded-lg shadow-lg">
            {submitted ? (
                <div className="text-center py-10">
                    <h2 className="text-2xl font-bold text-green-600">Thank You!</h2>
                    <p className="text-gray-600 mt-2">Your message has been sent successfully. We will get back to you shortly.</p>
                    <button onClick={() => setSubmitted(false)} className="mt-6 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Send Another Message</button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input type="text" name="name" id="name" required value={formData.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input type="email" name="email" id="email" required value={formData.email} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                     <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
                        <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                        <textarea name="message" id="message" rows={4} required value={formData.message} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>
                    <div>
                        <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Send Message
                        </button>
                    </div>
                </form>
            )}
        </div>
        
        <div className="text-center my-6 text-gray-500 font-semibold">OR</div>

        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.55C8.75 21.33 10.36 21.79 12.04 21.79C17.5 21.79 21.95 17.34 21.95 11.88C21.95 6.42 17.5 2 12.04 2M12.04 3.67C16.56 3.67 20.28 7.38 20.28 11.88C20.28 16.38 16.56 20.1 12.04 20.1C10.53 20.1 9.09 19.68 7.85 18.96L7.49 18.76L4.44 19.6L5.33 16.64L5.12 16.28C4.33 15 3.8 13.47 3.8 11.91C3.8 7.42 7.52 3.67 12.04 3.67M17.15 14.47C16.95 14.93 15.82 15.54 15.4 15.71C14.98 15.88 14.59 15.91 14.24 15.78C13.89 15.65 12.98 15.34 11.93 14.36C10.66 13.21 9.89 11.83 9.72 11.48C9.55 11.13 9.72 10.89 9.89 10.72C10.04 10.55 10.23 10.34 10.43 10.14C10.61 9.96 10.66 9.83 10.78 9.59C10.89 9.35 10.84 9.14 10.75 8.97C10.67 8.8 10.24 7.75 10.05 7.3C9.86 6.84 9.68 6.9 9.53 6.9H9.1C8.91 6.9 8.62 6.98 8.37 7.22C8.12 7.46 7.46 8.07 7.46 9.24C7.46 10.41 8.39 11.52 8.53 11.7C8.68 11.87 10.16 14.19 12.45 15.11C13.23 15.42 13.78 15.6 14.22 15.73C14.85 15.91 15.35 15.86 15.72 15.53C16.15 15.15 16.79 14.53 16.99 14.07C17.19 13.61 17.19 13.24 17.15 13.11L17.15 14.47Z" />
            </svg>
            Contact on WhatsApp
        </a>
    </div>
  );
};

export default Contact;