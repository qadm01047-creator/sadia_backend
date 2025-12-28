import { create, getAll } from '../lib/db';
import { hashPassword } from '../lib/auth';
import { User, Category, Product } from '../types';

async function seed() {
  console.log('🌱 Starting database seed...');

  // Seed Users
  const existingUsers = getAll<User>('users');
  if (existingUsers.length === 0) {
    console.log('👤 Creating users...');
    
    const superadminPassword = await hashPassword('superadmin123');
    create<User>('users', {
      email: 'superadmin@sadia.lux',
      password: superadminPassword,
      role: 'SUPERADMIN',
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Created SuperAdmin: superadmin@sadia.lux / superadmin123');

    const adminPassword = await hashPassword('admin123');
    create<User>('users', {
      email: 'admin@sadia.lux',
      password: adminPassword,
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Created Admin: admin@sadia.lux / admin123');

    const cashierPassword = await hashPassword('cashier123');
    create<User>('users', {
      email: 'cashier@sadia.lux',
      password: cashierPassword,
      role: 'CASHIER',
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Created Cashier: cashier@sadia.lux / cashier123');
  } else {
    console.log('ℹ️ Users already exist');
  }

  // Seed Categories
  const existingCategories = getAll<Category>('categories');
  if (existingCategories.length === 0) {
    console.log('📦 Creating categories...');
    
    const categories = [
      { name: 'Платья', slug: 'platya', description: 'Элегантные платья для мусульманок' },
      { name: 'Блузки', slug: 'bluzki', description: 'Стильные блузки' },
      { name: 'Хиджабы', slug: 'hidjaby', description: 'Качественные хиджабы' },
      { name: 'Аксессуары', slug: 'aksessuary', description: 'Модные аксессуары' },
    ];

    const createdCategories: Category[] = [];
    for (const cat of categories) {
      const category = create<Category>('categories', {
        ...cat,
        createdAt: new Date().toISOString(),
      });
      createdCategories.push(category);
    }
    console.log(`✅ Created ${createdCategories.length} categories`);
  } else {
    console.log('ℹ️ Categories already exist');
  }

  console.log('✨ Seeding completed!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});

