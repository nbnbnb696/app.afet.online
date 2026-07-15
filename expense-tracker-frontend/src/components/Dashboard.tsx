import React, { useState, useEffect } from 'react';
import { transactionAPI, Transaction, TransactionRequest } from '../services/api';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TransactionRequest>({
    description: '',
    amount: 0,
    type: 'EXPENSE',
    date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await transactionAPI.getAll();
      setTransactions(response.data);
    } catch (err) {
      setError('Failed to load transactions. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await transactionAPI.create(formData);
      setFormData({
        description: '',
        amount: 0,
        type: 'EXPENSE',
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      loadTransactions();
    } catch (err) {
      setError('Failed to create transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await transactionAPI.delete(id);
        loadTransactions();
      } catch (err) {
        setError('Failed to delete transaction. Please try again.');
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    onLogout();
  };

  const totalIncome = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>Expense Tracker</h1>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', backgroundColor: '#ffe8e8', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div style={{ padding: '20px', backgroundColor: '#e8f5e8', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Total Income</h3>
          <p style={{ fontSize: '24px', color: '#28a745', margin: 0 }}>₹{totalIncome.toFixed(2)}</p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#ffe8e8', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Total Expense</h3>
          <p style={{ fontSize: '24px', color: '#dc3545', margin: 0 }}>₹{totalExpense.toFixed(2)}</p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#e8f4fd', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Balance</h3>
          <p style={{ fontSize: '24px', color: balance >= 0 ? '#28a745' : '#dc3545', margin: 0 }}>
            ₹{balance.toFixed(2)}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '12px 24px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : 'Add Transaction'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <input
              type="number"
              placeholder="Amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
              style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' }}>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'INCOME' | 'EXPENSE' })}
              style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px 24px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {loading ? 'Adding...' : 'Add Transaction'}
          </button>
        </form>
      )}

      <div>
        <h3>Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p>No transactions found. Add your first transaction!</p>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #eee' }}
              >
                <div>
                  <h4 style={{ margin: '0 0 5px 0' }}>{transaction.description}</h4>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{transaction.date}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: transaction.type === 'INCOME' ? '#28a745' : '#dc3545' }}>
                    {transaction.type === 'INCOME' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
