import { supabase } from './supabaseClient'

async function testSupabaseConnection() {
  const result = document.getElementById('result')

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .limit(5)

    if (error) {
      throw error
    }

    console.log('Koneksi Supabase berhasil:', data)

    if (result) {
      result.textContent =
        'KONEKSI BERHASIL!\n\nData kategori:\n' +
        JSON.stringify(data, null, 2)
    }
  } catch (error) {
    console.error('Koneksi Supabase gagal:', error)

    if (result) {
      result.textContent =
        'KONEKSI GAGAL!\n\n' +
        (error instanceof Error ? error.message : String(error))
    }
  }
}

testSupabaseConnection()


export async function testReadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, category_id, unit, purchase_price, selling_price, current_stock')
    .limit(5);

  if (error) {
    console.error('Gagal membaca produk:', error.message);
    return;
  }

  console.log('Produk berhasil dibaca:', data);
}
