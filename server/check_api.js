async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/bookings');
    console.log('API Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('API Bookings Count:', data.length);
      data.forEach(b => {
        console.log(`- ID: ${b.bookingId}, Status: ${b.status}, Customer: ${b.customerName || b.customer?.name}`);
      });
    } else {
      console.log('API failed:', await res.text());
    }
  } catch(e) {
    console.error('Fetch error:', e.message);
  }
}
test();
