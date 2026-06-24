import supabase from '../supabase.js';

// POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email wajib diisi.' });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CLIENT_URL}/reset-password`,
  });

  if (error) {
    return res.status(400).json({ message: 'Gagal mengirim email reset.' });
  }

  // Selalu return sukses meski email tidak terdaftar (keamanan)
  return res.json({ message: 'Email reset telah dikirim jika akun terdaftar.' });
};