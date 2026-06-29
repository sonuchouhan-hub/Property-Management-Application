import { Project, Plot, PlotStatus, PlotFacing, Article, PlotType } from './types';

const generatePlots = (count: number, projectId: number): Plot[] => {
  const plots: Plot[] = [];
  const statuses = [PlotStatus.AVAILABLE, PlotStatus.BOOKED, PlotStatus.SOLD, PlotStatus.INVESTMENT, PlotStatus.RESALE, PlotStatus.AVAILABLE, PlotStatus.AVAILABLE];
  const facings = [PlotFacing.NORTH, PlotFacing.SOUTH, PlotFacing.EAST, PlotFacing.WEST, PlotFacing.NORTH_EAST];
  const types = [PlotType.EWA, PlotType.LIG, PlotType.NORMAL];
  for (let i = 1; i <= count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const facing = facings[Math.floor(Math.random() * facings.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const size = Math.floor(Math.random() * 10 + 10) * 100; // 1000 to 2000 sq ft
    const width = Math.round(Math.sqrt(size) * (Math.random() * 0.4 + 0.8));
    const length = Math.round(size / width);
    plots.push({
      id: (projectId * 1000) + i, // Unique plot id
      number: `P-${100 + i}`,
      size,
      dimensions: `${width}x${length}`,
      facing,
      status,
      type,
      price: size * (Math.floor(Math.random() * 800) + 1200), // Price per sq ft for Indore region
      isMortgaged: Math.random() < 0.1, // 10% mortgaged
      imageUrl: i % 10 === 0 ? `https://picsum.photos/seed/plot${projectId}${i}/400/300` : undefined,
    });
  }
  return plots;
};

// Generate plot data for all projects
const vrindavanPlots = generatePlots(120, 1);
const keshvamPlots = generatePlots(90, 2);
const divinePlots = generatePlots(150, 3);
const maaGinniExtPlots = generatePlots(200, 4);
const maaGinniPlots = generatePlots(180, 5);
const greenwoodPlots = generatePlots(100, 6);
const redwoodPlots = generatePlots(130, 7);
const shivajiPlots = generatePlots(160, 8);

export const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    name: 'Vrindavan Dream City',
    location: 'Rau, Indore',
    description: "Vrindavan Dream City is a well-planned township near Rau, Indore, combining modern infrastructure with serene living. It features a grand entrance gate, secure boundary walls, and 30-foot-wide concrete roads for safety and convenience. Beautiful gardens with walking tracks enhance the lifestyle, while a double-capacity overhead water tank ensures uninterrupted supply. Close to top schools like Medi-Caps and Penfield International, it’s perfect for families.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68396668b3090-1748592232.png', 'https://dhanshriinfrabulls.co.in/uploads/68396631a79ba-1748592177.jpg', 'https://dhanshriinfrabulls.co.in/uploads/683965aaa62eb-1748592042.jpg', 'https://dhanshriinfrabulls.co.in/uploads/683964865bf38-1748591750.jpg'],
    totalPlots: vrindavanPlots.length,
    availablePlots: vrindavanPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.64, lng: 75.81 },
    layout: vrindavanPlots,
    amenities: ['Grand Entrance Gate', 'Secure Boundary Walls', 'Concrete Roads', 'Gardens with Walking Tracks', 'Overhead Water Tank', '24/7 Security'],
  },
  {
    id: 2,
    name: 'Shree Keshvam Corridor',
    location: 'Ujjain Road, Indore',
    description: "Shree Keshvam Corridor is a thoughtfully planned residential township that blends spiritual charm with modern living. Located near key areas, it features landscaped gardens, a serene temple, a grand fountain, a stylish gazebo, and peaceful walking tracks. The 60 ft. wide main road ensures smooth internal connectivity. Designed for those seeking harmony, comfort, and convenience, it offers an ideal setting for families and individuals alike.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/667bf7bc7154f-1719400380.jpg', 'https://dhanshriinfrabulls.co.in/uploads/667d0d438c888-1719471427.jpg', 'https://dhanshriinfrabulls.co.in/uploads/667d0d19028a7-1719471385.jpg', 'https://dhanshriinfrabulls.co.in/uploads/6851299cc7ddb-1750149532.png'],
    totalPlots: keshvamPlots.length,
    availablePlots: keshvamPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.75, lng: 75.86 },
    layout: keshvamPlots,
    amenities: ['Landscaped Gardens', 'Temple', 'Grand Fountain', 'Gazebo', 'Walking Tracks', 'Wide Main Road'],
  },
  {
    id: 3,
    name: 'Divine Park',
    location: 'Pigdambar, Indore',
    description: "Divine Park is a promising residential project in Pigdambar, Indore, offering various home options to suit different budgets. RERA-registered, it ensures transparency and trust for buyers and investors. The project enjoys excellent connectivity, with Rau railway station and key landmarks like Dr. P.S. Hardia Eye Institute nearby. Located in the affordable and developing locality of Pigdambar, Divine Park is ideal for homebuyers seeking a balanced lifestyle.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68396cf598a5b-1748593909.png', 'https://dhanshriinfrabulls.co.in/uploads/68396c19203d2-1748593689.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68396ab5a7d5f-1748593333.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68396a6010a78-1748593248.jpg'],
    totalPlots: divinePlots.length,
    availablePlots: divinePlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.62, lng: 75.815 },
    layout: divinePlots,
    amenities: ['RERA Registered', 'Excellent Connectivity', '24/7 Security', 'Water Supply', 'Internal Roads'],
  },
  {
    id: 4,
    name: 'Maa Ginni Vihar Extension',
    location: 'Rau, Indore',
    description: "Maa Ginni Vihar Extension is a premium residential township near Rau, Indore, offering a peaceful yet well-connected lifestyle. Spread across multiple acres, it features lush central greens, playgrounds, and well-planned recreational spaces—perfect for families seeking comfort, convenience, and community living. Its strategic location ensures easy access to reputed schools, hospitals, shopping centers, and entertainment hubs.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/6851309dba645-1750151325.jpg', 'https://dhanshriinfrabulls.co.in/uploads/6851306152e51-1750151265.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68513026f2fe8-1750151206.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68512ff738765-1750151159.jpg'],
    totalPlots: maaGinniExtPlots.length,
    availablePlots: maaGinniExtPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.645, lng: 75.805 },
    layout: maaGinniExtPlots,
    amenities: ['Central Greens', 'Playgrounds', 'Recreational Spaces', 'Gated Community', '24/7 Security'],
  },
  {
    id: 5,
    name: 'Maa Ginni Vihar',
    location: 'Rau, Indore',
    description: "Maa Ginni Vihar is a premium residential township near Rau, Indore, offering a peaceful yet well-connected lifestyle. Spread across acres of lush green spaces and recreational areas, it’s perfect for families seeking comfort, convenience, and community living. Located close to reputed schools, hospitals, shopping malls, and entertainment hubs, it ensures everything you need is nearby.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68270ea3a5309-1747390115.png', 'https://dhanshriinfrabulls.co.in/uploads/68ca954fe17d8-1758106959.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/68ca954fd9af5-1758106959.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/68ca954fcc8d8-1758106959.jpeg'],
    totalPlots: maaGinniPlots.length,
    availablePlots: maaGinniPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.638, lng: 75.812 },
    layout: maaGinniPlots,
    amenities: ['Lush Green Spaces', 'Recreational Areas', 'Gated Community', '24/7 Security', 'Modern Infrastructure'],
  },
  {
    id: 6,
    name: 'GreenWood Park',
    location: 'Rau, Indore',
    description: "GreenWood Park is a gated residential project in Rau, Indore, offering a perfect blend of comfort and connectivity. It features wide concrete roads, landscaped gardens, a peaceful temple, and essential modern amenities. With excellent access to IIM Indore, Pithampur, and A.B. Road, it ensures smooth daily commutes. The project is close to schools, hospitals, markets, and entertainment hubs, making life convenient for families.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68317ff24316a-1748074482.png', 'https://dhanshriinfrabulls.co.in/uploads/68513c190350c-1750154265.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68513bd7b9d46-1750154199.jpg', 'https://dhanshriinfrabulls.co.in/uploads/683861893f65a-1748525449.jpg'],
    totalPlots: greenwoodPlots.length,
    availablePlots: greenwoodPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.642, lng: 75.80 },
    layout: greenwoodPlots,
    amenities: ['Gated Community', 'Wide Concrete Roads', 'Landscaped Gardens', 'Temple', 'Modern Amenities'],
  },
  {
    id: 7,
    name: 'Red Wood Platinum',
    location: 'Pigdambar, Rau, Indore',
    description: "Red Wood Platinum is a premium township at Pigdamber, Rau, Indore, offering luxurious living with wide cement concrete roads, pleasant gardens, and modern amenities. Surrounded by top schools, colleges like IIM Indore, hospitals, malls, and entertainment hubs, it ensures convenience and comfort. The project features double-capacity overhead water tanks and serene walking tracks.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68397ec5b9ecb-1748598469.jpg', 'https://dhanshriinfrabulls.co.in/uploads/68397d1698662-1748598038.jpg', 'https://dhanshriinfrabulls.co.in/uploads/6833ffcf1db07-1748238287.png', 'https://dhanshriinfrabulls.co.in/uploads/6833ff73cc8c0-1748238195.jpg'],
    totalPlots: redwoodPlots.length,
    availablePlots: redwoodPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.618, lng: 75.81 },
    layout: redwoodPlots,
    amenities: ['Wide Cement Concrete Roads', 'Pleasant Gardens', 'Modern Amenities', 'Overhead Water Tanks', 'Walking Tracks'],
  },
  {
    id: 8,
    name: 'Shivaji Park',
    location: 'Pithampur Industrial Area, Indore',
    description: "Shivaji Park is a thoughtfully planned residential township at Pithampur Industrial Area, Indore. It offers spacious plots, wide cement concrete roads, landscaped gardens with walking tracks, and essential amenities for comfortable living. Surrounded by renowned schools, colleges like IIM Indore, hospitals, malls, and entertainment zones, it ensures excellent connectivity and lifestyle convenience.",
    imageUrls: ['https://dhanshriinfrabulls.co.in/uploads/68340f3103373-1748242225.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/683d95156407d-1748866325.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/68340fe8313f6-1748242408.jpeg', 'https://dhanshriinfrabulls.co.in/uploads/68340fbced289-1748242364.jpeg'],
    totalPlots: shivajiPlots.length,
    availablePlots: shivajiPlots.filter(p => p.status === PlotStatus.AVAILABLE || p.status === PlotStatus.RESALE).length,
    coords: { lat: 22.61, lng: 75.68 },
    layout: shivajiPlots,
    amenities: ['Wide Cement Concrete Roads', 'Landscaped Gardens', 'Walking Tracks', 'Gated Community', 'Essential Amenities'],
  }
];


export const MOCK_ARTICLES: Article[] = [
  {
    id: 1,
    title: "Why Rau, Indore is Madhya Pradesh's Premier Real Estate Hotspot",
    summary: "Rau, Indore's real estate market is witnessing unprecedented growth. Discover why this strategic hub in MP promises high returns on investment and excellent living standards.",
    imageUrl: "https://picsum.photos/seed/a1/400/300",
    category: "Investment Guide",
  },
  {
    id: 2,
    title: "The Ultimate Checklist for Buying a Plot in Rau, Indore",
    summary: "Buying a plot in Indore district requires specific legal checks. From Diversion (non-agricultural status) to RERA verification, here is your essential guide before buying land in Rau.",
    imageUrl: "https://picsum.photos/seed/a2/400/300",
    category: "Buyer's Tips",
  },
  {
    id: 3,
    title: "Vastu Shastra Tips for Premium Plots in Rau Townships",
    summary: "Harmonize your living space in Indore. Learn how to plan the perfect home layout for premium plots in gated communities around Rau to attract peace, health, and prosperity.",
    imageUrl: "https://picsum.photos/seed/a3/400/300",
    category: "Home & Lifestyle",
  },
  {
    id: 4,
    title: "Understanding MP RERA: Secure Plot Buying in Indore District",
    summary: "The Madhya Pradesh Real Estate Regulatory Authority (MP RERA) protects plot buyers in Indore. Learn how to verify registration numbers and keep your investment 100% secure.",
    imageUrl: "https://picsum.photos/seed/a4/400/300",
    category: "Legal & Finance",
  },
  {
    id: 5,
    title: "The Rise of Gated Communities in Rau, Indore",
    summary: "Modern families in Indore are prioritizing premium security, landscaped gardens, and wide concrete roads. Explore why gated townships in Rau are the most desired housing trend.",
    imageUrl: "https://picsum.photos/seed/a5/400/300",
    category: "Trends",
  },
  {
    id: 6,
    title: "Eco-Friendly Living: Sustainable Homes in Indore's Climate",
    summary: "Implement rainwater harvesting and solar panels on your plot in Rau. Learn about Indore Municipal Corporation (IMC) guidelines and sustainable living benefits in MP.",
    imageUrl: "https://picsum.photos/seed/a6/400/300",
    category: "Home & Lifestyle",
  }
];