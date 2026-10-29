// Fixture documents that mimic the *shape variety* of the real `properties` collection.
// They exist only inside the test-suite; the app never ships or inserts them.
module.exports = [
  { title: 'Skyline Residency', city: 'Mumbai', locality: 'Andheri West', propertyType: 'Flats/Apartments', bhk: '2 BHK', price: 12500000, area: { value: 950, unit: 'sq.ft' }, possessionStatus: 'Ready to Move', developerName: 'Alpha Builders', featured: true, coverImage: { url: 'https://img.test/a.jpg' }, amenities: ['Gym', 'Pool'], reraNumber: 'P51800001', createdAt: new Date('2026-01-05') },
  { name: 'Lakeview Towers', city: 'Pune', locality: 'Baner', propertyGroup: 'New Project', bedrooms: 3, price: { min: 8000000, max: 15000000 }, superBuiltUpArea: 1450, possession: 'New Launch', builderName: 'Beta Group', images: ['https://img.test/b1.jpg', 'https://img.test/b2.jpg'], createdAt: new Date('2026-02-10') },
  { title: 'Green Acres Plot', city: 'Mumbai', locality: 'Panvel', type: 'Plot', price: '45 L', status: 'Upcoming', createdAt: new Date('2026-03-01') },
  { title: 'Harbour Heights', city: 'Mumbai', locality: 'Colaba', propertyType: 'Flats/Apartments', bhk: 3, amount: 30000000, status: 'Under Construction', developerName: 'Alpha Builders', createdAt: new Date('2026-03-15') },
  { title: 'Hidden Pending Listing', city: 'Mumbai', locality: 'Bandra', propertyType: 'Flats/Apartments', bhk: '1', price: 9000000, approvalStatus: 'pending', dataSource: 'manual', createdAt: new Date('2026-04-01') },
];
