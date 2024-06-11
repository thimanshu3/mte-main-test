import {
  DollarOutlined,
  HomeOutlined,
  OrderedListOutlined,
  SettingOutlined,
  SlidersOutlined,
  SolutionOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined
} from '@ant-design/icons'
import {
  Layout as AntLayout,
  Breadcrumb,
  ConfigProvider,
  Menu,
  Skeleton,
  theme
} from 'antd'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { FC, useEffect, useState } from 'react'
import { BsWhatsapp } from 'react-icons/bs'
import { useDarkMode } from '~/context/darkMode'
import { Footer } from './Footer'
import { Header } from './Header'

export const Layout: FC<{
  children: React.ReactNode
  title?: string
  loading?: boolean
  breadcrumbs?: { label: string; link?: string }[]
}> = ({ children, title, loading, breadcrumbs }) => {
  const { data: session } = useSession()
  const { isDarkMode } = useDarkMode()

  const [collapsed, setCollapsed] = useState(true)
  const [collapsedWidth, setCollapsedWidth] = useState(80)

  useEffect(() => {
    const fn = () => setCollapsedWidth(window.innerWidth >= 768 ? 80 : 0)
    fn()
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  return (
    <>
      {title ? (
        <Head>
          <title>{title}</title>
        </Head>
      ) : null}

      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm
        }}
      >
        <AntLayout hasSider>
          <AntLayout.Sider
            style={{
              position: 'fixed',
              zIndex: 1000,
              overflow: 'auto',
              height: '100dvh'
            }}
            trigger={null}
            collapsible
            breakpoint="md"
            collapsedWidth={collapsedWidth}
            collapsed={collapsed}
            theme={isDarkMode ? 'light' : 'dark'}
          >
            <Menu
              theme={isDarkMode ? 'light' : 'dark'}
              mode="inline"
              defaultSelectedKeys={
                breadcrumbs?.length &&
                breadcrumbs[breadcrumbs.length - 1]?.label
                  ? [breadcrumbs[breadcrumbs.length - 1]?.label!]
                  : []
              }
              items={[
                {
                  key: 'Home',
                  label: <Link href="/">Home</Link>,
                  icon: <HomeOutlined />
                },
                ...(!['SUPPLIER'].includes(session?.user.role || '')
                  ? [
                      {
                        key: 'Setup',
                        label: 'Setup',
                        icon: <SettingOutlined />,
                        children: [
                          {
                            key: 'Users',
                            label: <Link href="/users">Users</Link>,
                            icon: <UserOutlined />
                          },
                          {
                            key: 'Master',
                            label: 'Master',
                            icon: <SlidersOutlined />,
                            children: [
                              {
                                key: 'Units',
                                label: <Link href="/units">Units</Link>
                              },
                              {
                                key: 'GST Rates',
                                label: <Link href="/gst-rates">GST Rates</Link>
                              },
                              {
                                key: 'Inquiry Statuses',
                                label: (
                                  <Link href="/inquiry-statuses">
                                    Inquiry Statuses
                                  </Link>
                                )
                              },
                              {
                                key: 'Inquiry Results',
                                label: (
                                  <Link href="/inquiry-results">
                                    Inquiry Results
                                  </Link>
                                )
                              },
                              {
                                key: 'Inquiry Cancel Reasons',
                                label: (
                                  <Link href="/inquiry-cancel-reasons">
                                    Inquiry Cancel Reasons
                                  </Link>
                                )
                              },
                              {
                                key: 'Business Types',
                                label: (
                                  <Link href="/business-types">
                                    Business Types
                                  </Link>
                                )
                              },
                              {
                                key: 'Payment Terms',
                                label: (
                                  <Link href="/payment-terms">
                                    Payment Terms
                                  </Link>
                                )
                              },
                              {
                                key: 'Addresses',
                                label: <Link href="/addresses">Addresses</Link>
                              },
                              {
                                key: 'Ports',
                                label: <Link href="/ports">Ports</Link>
                              },
                              {
                                key: 'Expenses',
                                label: <Link href="/expenses">Expenses</Link>
                              },
                              {
                                key: 'Currency',
                                label: <Link href="/currency">Currency</Link>
                              },
                              {
                                key: 'Notify Parties',
                                label: (
                                  <Link href="/notify-parties">
                                    Notify Parties
                                  </Link>
                                )
                              },
                              {
                                key: 'Exporter Details',
                                label: (
                                  <Link href="/exporter-details">
                                    Exporter Details
                                  </Link>
                                )
                              },
                              {
                                key: 'Country Of Origins',
                                label: (
                                  <Link href="/country-of-origins">
                                    Country Of Origins
                                  </Link>
                                )
                              },
                              {
                                key: 'Lut',
                                label: <Link href="/lut">Lut</Link>
                              },
                              {
                                key: 'IecCode',
                                label: <Link href="/Iec">IecCode</Link>
                              }
                            ]
                          }
                        ]
                      },
                      {
                        key: 'Parties',
                        label: 'Parties',
                        icon: <TeamOutlined />,
                        children: [
                          {
                            key: 'Suppliers',
                            label: <Link href="/suppliers">Suppliers</Link>
                          },
                          {
                            key: 'Customers',
                            label: <Link href="/customers">Customers</Link>
                          }
                        ]
                      }
                    ]
                  : []),
                ...(session?.user.role !== 'SUPPLIER'
                  ? [
                      {
                        key: 'Inquiry',
                        label: 'Inquiries',
                        icon: <SolutionOutlined />,
                        children: [
                          {
                            key: 'Inquiries',
                            label: <Link href="/inquiries">All Inquiries</Link>
                          },
                          {
                            key: 'Inquiries Sent to Supplier',
                            label: (
                              <Link href="/inquiries-sent-to-supplier">
                                Inquiries Sent to Supplier
                              </Link>
                            )
                          },
                          {
                            key: 'Offer Sent to Customer',
                            label: (
                              <Link href="/offer-sent-to-customer">
                                Offer Sent to Customer
                              </Link>
                            )
                          }
                        ]
                      },
                      {
                        key: 'Orders',
                        label: 'Orders',
                        icon: <DollarOutlined />,
                        children: [
                          {
                            key: 'Sales',
                            label: <Link href="/orders/sales">Sales</Link>
                          },
                          {
                            key: 'Purchase',
                            label: <Link href="/orders/purchase">Purchase</Link>
                          },
                          {
                            key: 'Invoices',
                            label: <Link href="/invoices">Invoices</Link>
                          },
                          {
                            key: 'Inventory',
                            label: <Link href="/inventory">Inventory</Link>
                          },
                          {
                            key: 'Fulfilments',
                            label: <Link href="/fulfilments">Fulfilments</Link>
                          },
                          {
                            key: 'Bulk Create',
                            label: <Link href="/orders/bulk">Bulk Create</Link>
                          },
                          {
                            key: 'Sales Collection',
                            label: (
                              <Link href="/sales-collection">
                                Sales Collection
                              </Link>
                            )
                          },
                          {
                            key: 'Invoice Collection',
                            label: (
                              <Link href="/invoice-collection">
                                Invoice Collection
                              </Link>
                            )
                          },
                          {
                            key: 'Add Expense',
                            label: (
                              <Link href="/create-expense">Add Expense</Link>
                            )
                          },
                          {
                            key: 'Payment Requests',
                            label: (
                              <Link href="/payment-requests">
                                Payment Requests
                              </Link>
                            )
                          }
                        ]
                      }
                    ]
                  : [
                      {
                        key: 'Inquiries Sent to Supplier',
                        label: (
                          <Link href="/inquiries-sent-to-supplier">
                            Inquiries Sent to Supplier
                          </Link>
                        )
                      }
                    ]),
                ...(['ADMIN', 'ADMINVIEWER', 'USER', 'USERVIEWER'].includes(
                  session?.user.role || ''
                )
                  ? [
                      {
                        key: 'Whatsapp',
                        label: <Link href="/whatsapp">Whatsapp</Link>,
                        icon: <BsWhatsapp />
                      },
                      {
                        key: 'Tools',
                        label: 'Tools',
                        icon: <ToolOutlined />,
                        children: [
                          {
                            key: 'Parse Supplier PDF',
                            label: (
                              <Link href="/tools/parse-supplier-pdf">
                                Parse Supplier PDF
                              </Link>
                            )
                          },
                          {
                            key: 'Tabula (extract tables from PDF)',
                            label: (
                              <Link
                                href="http://tabula.ondata.it"
                                target="_blank"
                              >
                                Tabula (extract tables from PDF)
                              </Link>
                            )
                          }
                        ]
                      },
                      {
                        key: 'Task Management',
                        label: (
                          <Link href="/task-management/teams">
                            Task Management
                          </Link>
                        ),
                        icon: <OrderedListOutlined />
                      }
                    ]
                  : [])
              ]}
            />
          </AntLayout.Sider>
          <AntLayout
            className={`transition-all duration-300 ${
              collapsed ? 'md:ml-[80px]' : 'md:ml-[200px]'
            }`}
          >
            <Header
              sidebarCollapsed={collapsed}
              toggleSidebar={() => setCollapsed(prev => !prev)}
            />
            <AntLayout.Content
              className={`min-h-[calc(100dvh-110px)] px-2 md:px-4 lg:px-8`}
            >
              {breadcrumbs ? (
                <Breadcrumb
                  className="my-3"
                  items={breadcrumbs.map((b, i) => ({
                    key: i,
                    title: b.link ? (
                      <Link href={b.link}>{b.label}</Link>
                    ) : (
                      b.label
                    )
                  }))}
                />
              ) : null}
              {loading ? <Skeleton active /> : children}
            </AntLayout.Content>
            <Footer />
          </AntLayout>
        </AntLayout>
      </ConfigProvider>
    </>
  )
}
