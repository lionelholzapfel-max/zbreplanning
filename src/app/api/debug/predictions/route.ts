import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// GET /api/debug/predictions - Debug endpoint to check predictions table
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Check if we can read predictions
    const { data: allPredictions, error: readError } = await supabase
      .from('predictions')
      .select('*')
      .limit(5);

    // 2. Check if we can read user's predictions
    const { data: myPredictions, error: myError } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id);

    // 3. Try to insert a test prediction
    const testValue = `DEBUG_TEST_${Date.now()}`;
    const { data: insertResult, error: insertError } = await supabase
      .from('predictions')
      .insert({
        user_id: user.id,
        prediction_type: 'winner',
        prediction_value: testValue,
      })
      .select()
      .single();

    // 4. If insert worked, delete it
    let deleteResult = null;
    let deleteError = null;
    if (insertResult) {
      const { data, error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', insertResult.id)
        .select();
      deleteResult = data;
      deleteError = error;
    }

    // 5. Check RLS policies
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies_for_table', { table_name: 'predictions' })
      .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

    return NextResponse.json({
      user: { id: user.id, name: user.member_name },
      tests: {
        read_all: { success: !readError, count: allPredictions?.length, error: readError?.message },
        read_mine: { success: !myError, count: myPredictions?.length, error: myError?.message },
        insert: { success: !insertError, data: insertResult, error: insertError?.message, code: insertError?.code },
        delete: { success: !deleteError, data: deleteResult, error: deleteError?.message },
      },
      policies: policies || policiesError?.message || 'N/A',
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Exception',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
